import { describe, expect, it } from 'vitest';

import { Des, retailMac } from './des';
import { bytes, key as hex } from './testing/scripted-channel';

const text = (value: string) => new TextEncoder().encode(value);

// FIPS 81 appendix B and the classic DES worked example; cross-checked with OpenSSL.
const FIPS_KEY = bytes('0123456789abcdef');
const FIPS_IV = bytes('1234567890abcdef');
const FIPS_PLAIN = text('Now is the time for all ');
const FIPS_ECB = '3fa40e8a984d48156a271787ab8883f9893d51ec4b563b53';
const FIPS_CBC = 'e5c7cdde872bf27c43e934008c389c0f683788499a7c05f6';

describe('Des', () => {
  it('encrypts one block (the classic worked example)', () => {
    const des = new Des(bytes('133457799bbcdff1'));
    expect(hex(des.encryptEcb(bytes('0123456789abcdef')))).toBe('85e813540f0ab405');
  });

  it('encrypts and decrypts in ECB mode (FIPS 81)', () => {
    const des = new Des(FIPS_KEY);
    expect(hex(des.encryptEcb(FIPS_PLAIN))).toBe(FIPS_ECB);
    expect(des.decryptEcb(bytes(FIPS_ECB))).toEqual(FIPS_PLAIN);
  });

  it('encrypts and decrypts in CBC mode (FIPS 81)', () => {
    const des = new Des(FIPS_KEY);
    expect(hex(des.encryptCbc(FIPS_PLAIN, FIPS_IV))).toBe(FIPS_CBC);
    expect(des.decryptCbc(bytes(FIPS_CBC), FIPS_IV)).toEqual(FIPS_PLAIN);
  });

  it('chains CBC across calls when the next IV is the last ciphertext block', () => {
    const des = new Des(FIPS_KEY);
    const first = des.encryptCbc(FIPS_PLAIN.subarray(0, 8), FIPS_IV);
    const rest = des.encryptCbc(FIPS_PLAIN.subarray(8), first);
    expect(hex(first) + hex(rest)).toBe(FIPS_CBC);
  });

  it('leaves its input and IV unchanged', () => {
    const des = new Des(FIPS_KEY);
    const input = FIPS_PLAIN.slice();
    const iv = FIPS_IV.slice();
    des.encryptCbc(input, iv);
    expect(input).toEqual(FIPS_PLAIN);
    expect(iv).toEqual(FIPS_IV);
  });

  it('refuses a key that is not 8 bytes', () => {
    expect(() => new Des(bytes('0123'))).toThrow('8 bytes');
  });

  it('refuses data that is not a whole number of blocks', () => {
    expect(() => new Des(FIPS_KEY).encryptEcb(bytes('0102'))).toThrow('multiple of 8');
  });
});

describe('retailMac', () => {
  it('computes the ISO 9797-1 algorithm 3 MAC (ANSI X9.19 example)', () => {
    const key = bytes('0123456789abcdef fedcba9876543210');
    expect(hex(retailMac(key, FIPS_PLAIN))).toBe('a1c72e74ea3fa9b6');
  });

  it('derives a NetMD session key from the two nonces', () => {
    // EDE(K1, K2, K1) of devNonce XOR DES_K1(hostNonce), which netmd-js computes with crypto-js.
    const root = bytes('123456789abcdef0 0fedcba987654321');
    const nonces = bytes('0001020304050607 08090a0b0c0d0e0f');
    const k1 = new Des(root.subarray(0, 8));
    const k2 = new Des(root.subarray(8));
    const chained = k1.encryptCbc(nonces.subarray(8), k1.encryptEcb(nonces.subarray(0, 8)));
    const expected = k1.encryptEcb(k2.decryptEcb(chained));
    expect(retailMac(root, nonces)).toEqual(expected);
  });
});
