/*
 * Ported from netmd-js 4.4.1, src/encrypt-generator.ts and MDTrack in src/netmd-interface.ts
 * (https://github.com/cybercase/netmd-js), by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - A synchronous generator of ready-to-send packets: the 24-byte header (zeros, length, wrapped
 *   key, IV) is added here instead of in `sendTrack`.
 * - The random source is injected, so packets can be tested.
 * - 1024-byte packets by default, as webminidisc uses; upstream defaults to 1 MiB.
 * - Only the last chunk is copied for padding; upstream pads a copy of the whole track. A track
 *   with no audio is refused instead of sending a header with a length of zero.
 */

import { Des } from './des';

/** The key-encryption key every NetMD upload uses (netmd-js `MDTrack.getKEK`). */
export const KEY_ENCRYPTION_KEY = new Uint8Array([0x14, 0xe3, 0x83, 0x4e, 0xe2, 0xd3, 0xcc, 0xa5]);

/** The content ID every NetMD upload uses (netmd-js `MDTrack.getContentID`). */
export const CONTENT_ID = new Uint8Array([
  0x01, 0x0f, 0x50, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x48, 0xa2, 0x8d, 0x3e, 0x1a, 0x3b, 0x0c,
  0x44, 0xaf, 0x2f, 0xa0,
]);

const HEADER_LENGTH = 24;
const DEFAULT_PACKET_SIZE = 1024;
const KEY_LENGTH = 8;

export interface TrackPacketOptions {
  /** The audio in the wire format (big-endian PCM for SP, ATRAC3 frames for LP). */
  readonly data: Uint8Array;
  readonly frameSize: number;
  /** Returns `length` random bytes; the data key is drawn from it. */
  readonly random: (length: number) => Uint8Array;
  /** Bytes per bulk write, header included; a multiple of 8. */
  readonly packetSize?: number;
}

/** The audio's length padded to whole frames. */
export const paddedLength = (length: number, frameSize: number): number =>
  Math.ceil(length / frameSize) * frameSize;

/**
 * The packets of one track, ready to write to the bulk endpoint. The audio is padded with zeros
 * to whole frames and encrypted with DES-CBC under a random data key. The first packet starts with
 * the padded length and the data key wrapped so the device can unwrap it with the KEK.
 */
export function* trackPackets(
  options: TrackPacketOptions,
): Generator<Uint8Array<ArrayBuffer>, void, undefined> {
  const { data, frameSize } = options;
  if (data.length === 0) throw new Error('A track with no audio cannot be uploaded');
  const packetSize = options.packetSize ?? DEFAULT_PACKET_SIZE;
  const total = paddedLength(data.length, frameSize);

  const dataKey = options.random(KEY_LENGTH);
  const cipher = new Des(dataKey);
  // The device encrypts this field under the KEK to recover the data key.
  const wrappedKey = new Des(KEY_ENCRYPTION_KEY).decryptEcb(dataKey);
  const iv = new Uint8Array(KEY_LENGTH);

  let chain: Uint8Array = iv;
  for (let offset = 0; offset < total;) {
    const first = offset === 0;
    const end = Math.min(offset + (first ? packetSize - HEADER_LENGTH : packetSize), total);
    const encrypted = cipher.encryptCbc(chunk(data, offset, end), chain);
    chain = encrypted.subarray(encrypted.length - KEY_LENGTH);
    offset = end;
    if (!first) {
      yield encrypted;
      continue;
    }
    const packet = new Uint8Array(HEADER_LENGTH + encrypted.length);
    new DataView(packet.buffer).setUint32(4, total);
    packet.set(wrappedKey, 8);
    packet.set(iv, 16);
    packet.set(encrypted, HEADER_LENGTH);
    yield packet;
  }
}

/** Bytes `start` to `end` of the audio, zero-padded past its end (only the last chunk is). */
function chunk(data: Uint8Array, start: number, end: number): Uint8Array {
  if (end <= data.length) return data.subarray(start, end);
  const padded = new Uint8Array(end - start);
  padded.set(data.subarray(start));
  return padded;
}
