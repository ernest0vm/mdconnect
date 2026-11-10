import { describe, expect, it } from 'vitest';

import { Des } from './des';
import { KEY_ENCRYPTION_KEY, paddedLength, trackPackets } from './packets';

const RAW_KEY = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2]);
const fixedRandom = () => RAW_KEY.slice();

const audio = (length: number) => new Uint8Array(length).map((_, i) => i % 251);
const concat = (parts: readonly Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

describe('paddedLength', () => {
  it('rounds up to whole frames', () => {
    expect(paddedLength(2048, 2048)).toBe(2048);
    expect(paddedLength(2049, 2048)).toBe(4096);
    expect(paddedLength(1, 192)).toBe(192);
    expect(paddedLength(0, 96)).toBe(0);
  });
});

describe('trackPackets', () => {
  const data = audio(5000);
  const packets = [...trackPackets({ data, frameSize: 192, random: fixedRandom })];

  it('splits the track into 1024-byte packets, the first carrying a 24-byte header', () => {
    // 5000 bytes pad to 27 LP2 frames = 5184; 1000 + 4 × 1024 + 88.
    expect(packets.map((p) => p.length)).toEqual([1024, 1024, 1024, 1024, 1024, 88]);
  });

  it('starts with zeros, the padded length, the wrapped key and a zero IV', () => {
    const header = packets[0]?.subarray(0, 24) ?? new Uint8Array();
    expect([...header.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
    expect(new DataView(header.buffer).getUint32(4)).toBe(5184);
    expect([...header.subarray(16, 24)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('wraps the data key so that encrypting it under the KEK gives the key back, as the device does', () => {
    const wrapped = packets[0]?.subarray(8, 16) ?? new Uint8Array();
    expect(new Des(KEY_ENCRYPTION_KEY).encryptEcb(wrapped)).toEqual(RAW_KEY);
  });

  it('encrypts the padded audio with DES-CBC under the data key, chained across packets', () => {
    const ciphertext = concat([packets[0]?.subarray(24) ?? new Uint8Array(), ...packets.slice(1)]);
    const plain = new Des(RAW_KEY).decryptCbc(ciphertext, new Uint8Array(8));
    expect(plain.subarray(0, 5000)).toEqual(data);
    expect(plain.subarray(5000).every((b) => b === 0)).toBe(true);
    expect(plain).toHaveLength(5184);
  });

  it('sends a track shorter than one packet in a single packet', () => {
    const short = [...trackPackets({ data: audio(100), frameSize: 96, random: fixedRandom })];
    expect(short.map((p) => p.length)).toEqual([24 + 192]);
  });

  it('accepts another packet size', () => {
    const big = [
      ...trackPackets({ data: audio(5000), frameSize: 192, random: fixedRandom, packetSize: 4096 }),
    ];
    expect(big.map((p) => p.length)).toEqual([4096, 1112]);
  });

  it("leaves the caller's audio untouched", () => {
    const source = audio(100);
    const copy = source.slice();
    expect([
      ...trackPackets({ data: source, frameSize: 96, random: fixedRandom }),
    ]).not.toHaveLength(0);
    expect(source).toEqual(copy);
  });

  it('refuses a track with no audio', () => {
    expect(() => [
      ...trackPackets({ data: new Uint8Array(), frameSize: 96, random: fixedRandom }),
    ]).toThrow(/no audio/i);
  });

  it.each([24, 16, 0, 1020, 1024.5])('refuses a packet size of %s', (packetSize) => {
    expect(() => [
      ...trackPackets({ data: audio(100), frameSize: 96, random: fixedRandom, packetSize }),
    ]).toThrow(/packet size/i);
  });
});
