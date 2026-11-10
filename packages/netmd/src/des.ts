/*
 * DES (FIPS 46-3) with ECB and CBC modes, and the ISO 9797-1 retail MAC, as needed by the NetMD
 * secure session. Written for mdconnect; the operations mirror what netmd-js 4.4.1
 * (https://github.com/cybercase/netmd-js, by Stefano Brilli and Asivery, GPL-2.0) does with
 * crypto-js in `netmd-interface.ts` (`retailmac`, `setupDownload`, `commitTrack`, `sendTrack`)
 * and `encrypt-generator.ts`. Web Crypto has no DES, and the library netmd-js uses is not on npm.
 *
 * Blocks are handled as two 32-bit halves. The initial and final permutations use byte lookup
 * tables, and each round uses eight S-box tables that already include the P permutation.
 */

const BLOCK = 8;

// prettier-ignore
const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];

// prettier-ignore
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
];

// prettier-ignore
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];

// prettier-ignore
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4,
  26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40,
  51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];

const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

// prettier-ignore
const S_BOXES = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

/** Bit `position` (1 = most significant) of a 64-bit block given as two 32-bit halves. */
const bit64 = (hi: number, lo: number, position: number): number =>
  position <= 32 ? (hi >>> (32 - position)) & 1 : (lo >>> (64 - position)) & 1;

/** Lookup tables applying a 64-bit permutation one input byte at a time. */
function permutationTables(order: readonly number[]): { hi: Uint32Array; lo: Uint32Array } {
  const hi = new Uint32Array(8 * 256);
  const lo = new Uint32Array(8 * 256);
  for (let byteIndex = 0; byteIndex < 8; byteIndex++) {
    for (let value = 0; value < 256; value++) {
      const shift = 24 - 8 * (byteIndex % 4);
      const inHi = byteIndex < 4 ? value << shift : 0;
      const inLo = byteIndex < 4 ? 0 : value << shift;
      let outHi = 0;
      let outLo = 0;
      order.forEach((source, index) => {
        if (bit64(inHi, inLo, source) === 0) return;
        if (index < 32) outHi |= 1 << (31 - index);
        else outLo |= 1 << (63 - index);
      });
      hi[byteIndex * 256 + value] = outHi >>> 0;
      lo[byteIndex * 256 + value] = outLo >>> 0;
    }
  }
  return { hi, lo };
}

const FP = IP.map((_, index) => IP.indexOf(index + 1) + 1);
const IP_TABLES = permutationTables(IP);
const FP_TABLES = permutationTables(FP);

/**
 * S-box `box` followed by P, for each 6-bit input: one lookup per S-box in a round. The eight
 * tables are stored back to back, so box `n` starts at `n * 64`.
 */
const SP = new Uint32Array(8 * 64);
S_BOXES.forEach((box, boxIndex) => {
  for (let input = 0; input < 64; input++) {
    const row = ((input & 0x20) >>> 4) | (input & 1);
    const column = (input >>> 1) & 0xf;
    const sOut = (box[row * 16 + column] ?? 0) << (28 - 4 * boxIndex);
    let out = 0;
    P.forEach((source, index) => {
      if ((sOut >>> (32 - source)) & 1) out |= 1 << (31 - index);
    });
    SP[boxIndex * 64 + input] = out >>> 0;
  }
});

function permute(tables: { hi: Uint32Array; lo: Uint32Array }, hi: number, lo: number) {
  let outHi = 0;
  let outLo = 0;
  for (let byteIndex = 0; byteIndex < 8; byteIndex++) {
    const value =
      byteIndex < 4 ? (hi >>> (24 - 8 * byteIndex)) & 0xff : (lo >>> (56 - 8 * byteIndex)) & 0xff;
    outHi |= tables.hi[byteIndex * 256 + value] ?? 0;
    outLo |= tables.lo[byteIndex * 256 + value] ?? 0;
  }
  return [outHi >>> 0, outLo >>> 0] as const;
}

/** The 16 round keys, each as eight 6-bit values, in encryption order. */
function roundKeys(key: Uint8Array): Uint8Array {
  const keyHi = readWord(key, 0);
  const keyLo = readWord(key, 4);
  let c = PC1.slice(0, 28).map((p) => bit64(keyHi, keyLo, p));
  let d = PC1.slice(28).map((p) => bit64(keyHi, keyLo, p));
  const keys = new Uint8Array(16 * 8);
  SHIFTS.forEach((shift, round) => {
    c = [...c.slice(shift), ...c.slice(0, shift)];
    d = [...d.slice(shift), ...d.slice(0, shift)];
    const cd = [...c, ...d];
    for (let group = 0; group < 8; group++) {
      let value = 0;
      for (let i = 0; i < 6; i++) value = (value << 1) | (cd[(PC2[group * 6 + i] ?? 1) - 1] ?? 0);
      keys[round * 8 + group] = value;
    }
  });
  return keys;
}

const readWord = (data: Uint8Array, offset: number): number =>
  (((data[offset] ?? 0) << 24) |
    ((data[offset + 1] ?? 0) << 16) |
    ((data[offset + 2] ?? 0) << 8) |
    (data[offset + 3] ?? 0)) >>>
  0;

function writeWord(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value >>> 24;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

function checkBlocks(data: Uint8Array): void {
  if (data.length % BLOCK !== 0) {
    throw new Error(`DES data must be a multiple of 8 bytes, got ${String(data.length)}`);
  }
}

/** Single DES with one 8-byte key (parity bits ignored). */
export class Des {
  private readonly encryptKeys: Uint8Array;
  private readonly decryptKeys: Uint8Array;

  constructor(key: Uint8Array) {
    if (key.length !== BLOCK) throw new Error(`A DES key is 8 bytes, got ${String(key.length)}`);
    this.encryptKeys = roundKeys(key);
    this.decryptKeys = new Uint8Array(16 * 8);
    for (let round = 0; round < 16; round++) {
      this.decryptKeys.set(
        this.encryptKeys.subarray((15 - round) * 8, (16 - round) * 8),
        round * 8,
      );
    }
  }

  encryptEcb(data: Uint8Array): Uint8Array<ArrayBuffer> {
    return this.ecb(data, this.encryptKeys);
  }

  decryptEcb(data: Uint8Array): Uint8Array<ArrayBuffer> {
    return this.ecb(data, this.decryptKeys);
  }

  /** CBC encryption. To continue a chain, pass the last 8 bytes of the previous output as `iv`. */
  encryptCbc(data: Uint8Array, iv: Uint8Array): Uint8Array<ArrayBuffer> {
    checkBlocks(data);
    const out = new Uint8Array(data.length);
    let prevHi = readWord(iv, 0);
    let prevLo = readWord(iv, 4);
    for (let offset = 0; offset < data.length; offset += BLOCK) {
      [prevHi, prevLo] = this.block(
        (readWord(data, offset) ^ prevHi) >>> 0,
        (readWord(data, offset + 4) ^ prevLo) >>> 0,
        this.encryptKeys,
      );
      writeWord(out, offset, prevHi);
      writeWord(out, offset + 4, prevLo);
    }
    return out;
  }

  decryptCbc(data: Uint8Array, iv: Uint8Array): Uint8Array<ArrayBuffer> {
    checkBlocks(data);
    const out = new Uint8Array(data.length);
    let prevHi = readWord(iv, 0);
    let prevLo = readWord(iv, 4);
    for (let offset = 0; offset < data.length; offset += BLOCK) {
      const inHi = readWord(data, offset);
      const inLo = readWord(data, offset + 4);
      const [hi, lo] = this.block(inHi, inLo, this.decryptKeys);
      writeWord(out, offset, hi ^ prevHi);
      writeWord(out, offset + 4, lo ^ prevLo);
      prevHi = inHi;
      prevLo = inLo;
    }
    return out;
  }

  private ecb(data: Uint8Array, keys: Uint8Array): Uint8Array<ArrayBuffer> {
    checkBlocks(data);
    const out = new Uint8Array(data.length);
    for (let offset = 0; offset < data.length; offset += BLOCK) {
      const [hi, lo] = this.block(readWord(data, offset), readWord(data, offset + 4), keys);
      writeWord(out, offset, hi);
      writeWord(out, offset + 4, lo);
    }
    return out;
  }

  private block(hi: number, lo: number, keys: Uint8Array): readonly [number, number] {
    let [left, right] = permute(IP_TABLES, hi, lo);
    for (let round = 0; round < 16; round++) {
      const k = round * 8;
      // The E expansion: eight overlapping 6-bit groups of `right`, wrapping at both ends.
      const f =
        (SP[(((right & 1) << 5) | (right >>> 27)) ^ (keys[k] ?? 0)] ?? 0) |
        (SP[64 | (((right >>> 23) & 0x3f) ^ (keys[k + 1] ?? 0))] ?? 0) |
        (SP[128 | (((right >>> 19) & 0x3f) ^ (keys[k + 2] ?? 0))] ?? 0) |
        (SP[192 | (((right >>> 15) & 0x3f) ^ (keys[k + 3] ?? 0))] ?? 0) |
        (SP[256 | (((right >>> 11) & 0x3f) ^ (keys[k + 4] ?? 0))] ?? 0) |
        (SP[320 | (((right >>> 7) & 0x3f) ^ (keys[k + 5] ?? 0))] ?? 0) |
        (SP[384 | (((right >>> 3) & 0x3f) ^ (keys[k + 6] ?? 0))] ?? 0) |
        (SP[448 | ((((right & 0x1f) << 1) | (right >>> 31)) ^ (keys[k + 7] ?? 0))] ?? 0);
      [left, right] = [right, (left ^ f) >>> 0];
    }
    return permute(FP_TABLES, right, left);
  }
}

/**
 * ISO 9797-1 MAC algorithm 3 (the "retail MAC"): DES-CBC under the first half of the 16-byte
 * key, with the last block finished by 2-key triple DES. NetMD derives its session key this way.
 */
export function retailMac(
  key: Uint8Array,
  data: Uint8Array,
  iv: Uint8Array = new Uint8Array(BLOCK),
): Uint8Array<ArrayBuffer> {
  if (key.length !== 2 * BLOCK) throw new Error('A retail MAC key is 16 bytes');
  checkBlocks(data);
  const k1 = new Des(key.subarray(0, BLOCK));
  const k2 = new Des(key.subarray(BLOCK));
  const chained = k1.encryptCbc(data, iv).subarray(data.length - BLOCK);
  return k1.encryptEcb(k2.decryptEcb(chained));
}
