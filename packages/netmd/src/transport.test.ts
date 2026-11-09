import { describe, expect, it } from 'vitest';

import { NetMdTimeoutError } from './errors';
import { NetMdTransport, type NetMdUsbDevice } from './transport';

type ControlSetup = Parameters<NetMdUsbDevice['controlTransferIn']>[0];

/** A device whose control-transfer replies the test scripts, recording what it was sent. */
function scriptedDevice(lengths: number[], replies: Uint8Array[]) {
  const sent: { request: number; data: Uint8Array }[] = [];
  const calls: string[] = [];
  let opened = false;
  const device: NetMdUsbDevice = {
    get opened() {
      return opened;
    },
    open: () => {
      calls.push('open');
      opened = true;
      return Promise.resolve();
    },
    selectConfiguration: (value) => {
      calls.push(`config ${String(value)}`);
      return Promise.resolve();
    },
    claimInterface: (iface) => {
      calls.push(`claim ${String(iface)}`);
      return Promise.resolve();
    },
    controlTransferIn: (setup: ControlSetup, length: number) => {
      if (setup.request === 0x01) {
        const len = lengths.shift() ?? 0;
        return Promise.resolve({ data: new DataView(new Uint8Array([0, 0, len, 0]).buffer) });
      }
      const reply = replies.shift() ?? new Uint8Array();
      expect(length).toBe(reply.length);
      return Promise.resolve({ data: new DataView(reply.buffer) });
    },
    controlTransferOut: (setup, data) => {
      sent.push({ request: setup.request, data: new Uint8Array(data as ArrayBuffer) });
      return Promise.resolve({});
    },
  };
  return { device, sent, calls };
}

const noSleep = () => Promise.resolve();

describe('NetMdTransport', () => {
  it('opens, selects configuration 1, claims interface 0 and drains a pending reply on init', async () => {
    const pending = new Uint8Array([0x09, 0xaa]);
    const { device, calls } = scriptedDevice([2, 2, 0], [pending]);
    await new NetMdTransport(device, { sleep: noSleep }).init();
    expect(calls).toEqual(['open', 'config 1', 'claim 0']);
  });

  it('does not reopen a device that is already open', async () => {
    const { device, calls } = scriptedDevice([0], []);
    await device.open();
    calls.length = 0;
    await new NetMdTransport(device, { sleep: noSleep }).init();
    expect(calls).toEqual(['config 1', 'claim 0']);
  });

  it('sends commands with vendor request 0x80', async () => {
    const { device, sent } = scriptedDevice([], []);
    await new NetMdTransport(device, { sleep: noSleep }).sendCommand(new Uint8Array([0x00, 0x18]));
    expect(sent).toEqual([{ request: 0x80, data: new Uint8Array([0x00, 0x18]) }]);
  });

  it('polls the reply length until the device has a reply, then reads it with request 0x81', async () => {
    const reply = new Uint8Array([0x09, 0x18, 0x08]);
    const { device } = scriptedDevice([0, 0, 3, 0], [reply]);
    const waits: number[] = [];
    const transport = new NetMdTransport(device, {
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect(await transport.readReply()).toEqual(reply);
    expect(waits).toEqual([10, 20]);
  });

  it('gives up with a timeout error when no reply arrives in time (disc-contents: "Command fails")', async () => {
    const { device } = scriptedDevice(new Array<number>(100).fill(0), []);
    let waited = 0;
    const transport = new NetMdTransport(device, {
      sleep: (ms) => {
        waited += ms;
        return Promise.resolve();
      },
      timeoutMs: 1000,
    });
    await expect(transport.readReply()).rejects.toBeInstanceOf(NetMdTimeoutError);
    // The whole budget is used, not just the doublings that fit under it.
    expect(waited).toBe(1000);
  });
});
