/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

import { Des } from './des';

const MEGABYTES = 10;
const PACKET = 1024;

/**
 * Throughput of DES-CBC in upload-sized packets. It takes about a second, so it only runs on
 * demand: `NETMD_THROUGHPUT=1 yarn workspace @mdconnect/netmd vitest run des-throughput`.
 * An SP minute is about 10.6 MB; the design asks for more than 20 MB/s.
 */
describe.runIf(import.meta.env.NETMD_THROUGHPUT === '1')('DES-CBC throughput', () => {
  it(`encrypts ${String(MEGABYTES)} MB faster than 20 MB/s`, () => {
    const des = new Des(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    const data = new Uint8Array(MEGABYTES * 1024 * 1024);
    const start = performance.now();
    let iv: Uint8Array = new Uint8Array(8);
    for (let offset = 0; offset < data.length; offset += PACKET) {
      iv = des.encryptCbc(data.subarray(offset, offset + PACKET), iv).subarray(PACKET - 8);
    }
    const megabytesPerSecond = MEGABYTES / ((performance.now() - start) / 1000);
    expect(megabytesPerSecond, `${megabytesPerSecond.toFixed(1)} MB/s`).toBeGreaterThan(20);
  });
});
