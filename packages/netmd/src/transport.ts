/*
 * Ported from netmd-js 4.4.1, src/netmd.ts (class NetMD)
 * (https://github.com/cybercase/netmd-js), by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - Works on a minimal device interface instead of `USBDevice`, so it stays platform-agnostic.
 * - `readReply` gives up after `timeoutMs` (upstream polls forever), unless a call asks for no
 *   limit, and polls at most once a second (upstream keeps doubling the interval).
 * - Every USB transfer fails after `transferTimeoutMs` (5 s) if it does not complete, so a
 *   device that stops answering at the USB level cannot leave a read waiting forever.
 * - No DES/3DES loading, factory commands, bulk reads or logging. `bulkWrite` (upstream
 *   `writeBulk`) is used by uploads; DES lives in des.ts.
 * - A transfer whose status is not "ok" (stall, babble) is an error; upstream uses its bytes. A
 *   bulk write the device only partly accepts is an error too.
 */

import { NetMdError, NetMdTimeoutError } from './errors';

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
  controlTransferIn(
    setup: ControlSetup,
    length: number,
  ): Promise<{
    readonly status?: 'ok' | 'stall' | 'babble' | undefined;
    data?: DataView | undefined;
  }>;
  controlTransferOut(setup: ControlSetup, data: BufferSource): Promise<unknown>;
  transferOut(
    endpointNumber: number,
    data: BufferSource,
  ): Promise<{
    readonly status?: 'ok' | 'stall' | 'babble' | undefined;
    readonly bytesWritten?: number | undefined;
  }>;
}

export interface ReadReplyOptions {
  /** Total time to wait for this reply; `Infinity` waits until the device answers or is gone. */
  readonly timeoutMs?: number;
}

/** Starts a timer that calls `onTimeout` after `ms`; returns a function that cancels it. */
export type TransferTimer = (ms: number, onTimeout: () => void) => () => void;

export interface TransportOptions {
  /** Total time to wait for a reply before failing; upstream has no limit. */
  readonly timeoutMs?: number;
  /**
   * Time one USB control transfer may take. A device that stops answering at the USB level
   * never completes a transfer, and WebUSB has no timeout of its own; upstream has none either.
   */
  readonly transferTimeoutMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly timer?: TransferTimer;
}

const REQUEST_REPLY_LENGTH = 0x01;
const REQUEST_SEND = 0x80;
const REQUEST_READ = 0x81;
const BULK_OUT_ENDPOINT = 2;
const FIRST_RETRY_MS = 10;
const MAX_RETRY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_TRANSFER_TIMEOUT_MS = 5_000;

const setup = (request: number): ControlSetup => ({
  requestType: 'vendor',
  recipient: 'interface',
  request,
  value: 0,
  index: 0,
});

const realTimer: TransferTimer = (ms, onTimeout) => {
  const id = setTimeout(onTimeout, ms);
  return () => {
    clearTimeout(id);
  };
};

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Low-level NetMD framing over vendor control transfers on interface 0. */
export class NetMdTransport {
  private readonly timeoutMs: number;
  private readonly transferTimeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timer: TransferTimer;

  constructor(
    private readonly device: NetMdUsbDevice,
    options: TransportOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.transferTimeoutMs = options.transferTimeoutMs ?? DEFAULT_TRANSFER_TIMEOUT_MS;
    this.sleep = options.sleep ?? realSleep;
    this.timer = options.timer ?? realTimer;
  }

  /** Claims the NetMD interface and discards any reply left over from an earlier session. */
  async init(): Promise<void> {
    if (!this.device.opened) await this.limited(this.device.open(), 'open');
    await this.limited(this.device.selectConfiguration(1), 'configuration');
    await this.limited(this.device.claimInterface(0), 'claim');
    if ((await this.replyLength()) > 0) await this.readReply();
  }

  async sendCommand(command: Uint8Array<ArrayBuffer>): Promise<void> {
    await this.limited(
      this.device.controlTransferOut(setup(REQUEST_SEND), command),
      'output transfer',
    );
  }

  /** Writes one packet of track data to the bulk OUT endpoint. */
  async bulkWrite(data: Uint8Array<ArrayBuffer>): Promise<void> {
    const result = await this.limited(
      this.device.transferOut(BULK_OUT_ENDPOINT, data),
      'bulk transfer',
    );
    if (result.status !== undefined && result.status !== 'ok') {
      throw new NetMdError(`USB bulk transfer ended with ${result.status}`);
    }
    if (result.bytesWritten !== undefined && result.bytesWritten !== data.length) {
      throw new NetMdError(
        `USB bulk transfer wrote ${String(result.bytesWritten)} of ${String(data.length)} bytes`,
      );
    }
  }

  /**
   * Waits for the device's reply, doubling the poll interval each time up to a second, for at
   * most `timeoutMs` (the transport's limit unless the call gives its own).
   */
  async readReply(options: ReadReplyOptions = {}): Promise<Uint8Array> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    let length = await this.replyLength();
    let waited = 0;
    for (let attempt = 0; length === 0; attempt++) {
      if (waited >= timeoutMs) {
        throw new NetMdTimeoutError(`No reply after ${String(waited)} ms`);
      }
      // Double the wait each time, but never past a second or the time limit.
      const delay = Math.min(FIRST_RETRY_MS * 2 ** attempt, MAX_RETRY_MS, timeoutMs - waited);
      await this.sleep(delay);
      waited += delay;
      length = await this.replyLength();
    }
    const result = await this.transferIn(REQUEST_READ, length);
    await this.replyLength();
    const data = result.data;
    return data ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array();
  }

  private async replyLength(): Promise<number> {
    const result = await this.transferIn(REQUEST_REPLY_LENGTH, 4);
    return result.data?.getUint8(2) ?? 0;
  }

  /** An input transfer that only counts when WebUSB reports it as "ok" (no status means ok). */
  private async transferIn(request: number, length: number) {
    const result = await this.limited(
      this.device.controlTransferIn(setup(request), length),
      `input transfer ${String(request)}`,
    );
    if (result.status !== undefined && result.status !== 'ok') {
      throw new NetMdError(`USB input transfer ${String(request)} ended with ${result.status}`);
    }
    return result;
  }

  /**
   * Fails a transfer that does not complete in time. WebUSB cannot cancel it: the transfer is
   * abandoned, and the caller reopens the session (initialising drains any late reply).
   */
  private limited<T>(transfer: Promise<T>, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cancel = this.timer(this.transferTimeoutMs, () => {
        reject(
          new NetMdTimeoutError(
            `USB ${what} did not complete in ${String(this.transferTimeoutMs)} ms`,
          ),
        );
      });
      transfer.then(
        (value) => {
          cancel();
          resolve(value);
        },
        (error: unknown) => {
          cancel();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }
}
