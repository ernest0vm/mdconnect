/*
 * Ported from netmd-js 4.4.1, src/encrypt-generator.ts and MDTrack in src/netmd-interface.ts
 * (https://github.com/cybercase/netmd-js), by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - A synchronous generator of ready-to-send packets: the 24-byte header (zeros, length, wrapped
 *   key, IV) is added here instead of in `sendTrack`.
 * - The random source is injected, so packets can be tested.
 * - 1024-byte packets by default, as webminidisc uses; upstream defaults to 1 MiB.
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
  const packetSize = options.packetSize ?? DEFAULT_PACKET_SIZE;
  const total = paddedLength(options.data.length, options.frameSize);
  const padded = new Uint8Array(total);
  padded.set(options.data);

  const dataKey = options.random(KEY_LENGTH);
  const cipher = new Des(dataKey);
  // The device encrypts this field under the KEK to recover the data key.
  const wrappedKey = new Des(KEY_ENCRYPTION_KEY).decryptEcb(dataKey);
  const iv = new Uint8Array(KEY_LENGTH);

  let chain: Uint8Array = iv;
  let offset = 0;
  let first = true;
  while (offset < total || first) {
    const room = first ? packetSize - HEADER_LENGTH : packetSize;
    const end = Math.min(offset + room, total);
    const encrypted = cipher.encryptCbc(padded.subarray(offset, end), chain);
    if (encrypted.length > 0) chain = encrypted.subarray(encrypted.length - KEY_LENGTH);
    if (first) {
      const packet = new Uint8Array(HEADER_LENGTH + encrypted.length);
      new DataView(packet.buffer).setUint32(4, total);
      packet.set(wrappedKey, 8);
      packet.set(iv, 16);
      packet.set(encrypted, HEADER_LENGTH);
      yield packet;
      first = false;
    } else {
      yield encrypted;
    }
    offset = end;
  }
}
