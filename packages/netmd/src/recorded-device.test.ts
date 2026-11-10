import { describe, expect, it } from 'vitest';

import { listContent } from './content';
import grouped from './fixtures/mz-ne410-grouped-lp4.json';
import { NetMdInterface } from './interface';
import { recordedDevice, type RecordedTransfer } from './recorded-device';
import { NetMdTransport } from './transport';

const noSleep = { sleep: () => Promise.resolve() };
const transfers = grouped.transfers as RecordedTransfer[];

async function read(device: ReturnType<typeof recordedDevice>, init: boolean) {
  const transport = new NetMdTransport(device, noSleep);
  if (init) await transport.init();
  const md = new NetMdInterface(transport, noSleep);
  return { present: await md.isDiscPresent(), disc: await listContent(md) };
}

describe('recordedDevice', () => {
  it('answers a full read from a recording', async () => {
    const { present, disc } = await read(recordedDevice(transfers), true);
    expect(present).toBe(true);
    expect(disc.trackCount).toBe(60);
  });

  it('answers the same read again, as a Refresh does on an open session', async () => {
    const device = recordedDevice(transfers);
    await read(device, true);
    const again = await read(device, false);
    expect(again.disc.trackCount).toBe(60);
  });

  it('rejects commands that are not in the recording', async () => {
    const md = new NetMdInterface(new NetMdTransport(recordedDevice(transfers), noSleep), noSleep);
    await expect(md.eraseTrack(0)).rejects.toThrow(/Rejected/u);
  });
});
