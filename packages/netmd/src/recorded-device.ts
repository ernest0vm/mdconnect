import type { NetMdUsbDevice } from './transport';

/** One control transfer as the recorder in the fixtures stores it. */
export interface RecordedTransfer {
  readonly dir: 'in' | 'out';
  readonly request: number;
  readonly data: string;
}

const REQUEST_REPLY_LENGTH = 0x01;
const REQUEST_SEND = 0x80;
const REQUEST_READ = 0x81;
const STATUS_REJECTED = '0a';

/** Bytes as lowercase hex, the form the recordings store. */
const toHex = (data: BufferSource) =>
  Array.from(
    ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** Hex from a recording as bytes. */
const fromHex = (hex: string) =>
  Uint8Array.from((hex.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

/**
 * A device that answers each command with the reply recorded for it, in any order and any number
 * of times, so an app can read a recorded disc as often as it likes. Commands that are not in the
 * recording are rejected, as a device rejects what it cannot do.
 *
 * For development and tests only: it is not a protocol implementation.
 */
export function recordedDevice(transfers: readonly RecordedTransfer[]): NetMdUsbDevice {
  const replies = new Map<string, string>();
  let command: string | null = null;
  for (const transfer of transfers) {
    if (transfer.dir === 'out' && transfer.request === REQUEST_SEND) command = transfer.data;
    else if (transfer.dir === 'in' && transfer.request === REQUEST_READ && command !== null) {
      if (!replies.has(command)) replies.set(command, transfer.data);
      command = null;
    }
  }

  let pending: Uint8Array<ArrayBuffer> | null = null;
  let opened = false;
  return {
    get opened() {
      return opened;
    },
    open: () => {
      opened = true;
      return Promise.resolve();
    },
    selectConfiguration: () => Promise.resolve(),
    claimInterface: () => Promise.resolve(),
    controlTransferOut: (setup, data) => {
      if (setup.request === REQUEST_SEND) {
        const sent = toHex(data);
        pending = fromHex(replies.get(sent) ?? STATUS_REJECTED + sent.slice(2));
      }
      return Promise.resolve({ status: 'ok' });
    },
    controlTransferIn: (setup) => {
      let bytes: Uint8Array<ArrayBuffer> = new Uint8Array(4);
      if (setup.request === REQUEST_REPLY_LENGTH && pending !== null) {
        bytes = Uint8Array.of(0x01, 0x81, pending.length, 0x00);
      } else if (setup.request === REQUEST_READ && pending !== null) {
        bytes = pending;
        pending = null;
      }
      return Promise.resolve({ status: 'ok', data: new DataView(bytes.buffer) });
    },
  };
}
