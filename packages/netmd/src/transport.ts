/*
 * Ported from netmd-js 4.4.1, src/netmd.ts (class NetMD)
 * (https://github.com/cybercase/netmd-js), by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - Works on a minimal device interface instead of `USBDevice`, so it stays platform-agnostic.
 * - `readReply` gives up after `timeoutMs` (upstream polls forever).
 * - No DES/3DES loading, factory commands, bulk transfers or logging: reading needs none of them.
 */

import { NetMdTimeoutError } from './errors';

interface ControlSetup {
  readonly requestType: 'vendor';
  readonly recipient: 'interface';
  readonly request: number;
  readonly value: number;
  readonly index: number;
}

/** The part of WebUSB's `USBDevice` that the NetMD transport uses. */
export interface NetMdUsbDevice {
  readonly opened: boolean;
  open(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  controlTransferIn(setup: ControlSetup, length: number): Promise<{ data?: DataView | undefined }>;
  controlTransferOut(setup: ControlSetup, data: BufferSource): Promise<unknown>;
}

export interface TransportOptions {
  /** Total time to wait for a reply before failing; upstream has no limit. */
  readonly timeoutMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const REQUEST_REPLY_LENGTH = 0x01;
const REQUEST_SEND = 0x80;
const REQUEST_READ = 0x81;
const FIRST_RETRY_MS = 10;
const DEFAULT_TIMEOUT_MS = 10_000;

const setup = (request: number): ControlSetup => ({
  requestType: 'vendor',
  recipient: 'interface',
  request,
  value: 0,
  index: 0,
});

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Low-level NetMD framing over vendor control transfers on interface 0. */
export class NetMdTransport {
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly device: NetMdUsbDevice,
    options: TransportOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleep = options.sleep ?? realSleep;
  }

  /** Claims the NetMD interface and discards any reply left over from an earlier session. */
  async init(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    await this.device.selectConfiguration(1);
    await this.device.claimInterface(0);
    if ((await this.replyLength()) > 0) await this.readReply();
  }

  async sendCommand(command: Uint8Array<ArrayBuffer>): Promise<void> {
    await this.device.controlTransferOut(setup(REQUEST_SEND), command);
  }

  /** Waits for the device's reply, doubling the poll interval each time, up to `timeoutMs`. */
  async readReply(): Promise<Uint8Array> {
    let length = await this.replyLength();
    let waited = 0;
    for (let attempt = 0; length === 0; attempt++) {
      if (waited >= this.timeoutMs) {
        throw new NetMdTimeoutError(`No reply after ${String(waited)} ms`);
      }
      // Double the wait each time, but never past the time limit.
      const delay = Math.min(FIRST_RETRY_MS * 2 ** attempt, this.timeoutMs - waited);
      await this.sleep(delay);
      waited += delay;
      length = await this.replyLength();
    }
    const result = await this.device.controlTransferIn(setup(REQUEST_READ), length);
    await this.replyLength();
    const data = result.data;
    return data ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array();
  }

  private async replyLength(): Promise<number> {
    const result = await this.device.controlTransferIn(setup(REQUEST_REPLY_LENGTH), 4);
    return result.data?.getUint8(2) ?? 0;
  }
}
