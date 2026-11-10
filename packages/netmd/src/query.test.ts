import { describe, expect, it } from 'vitest';

import { bcdToInt, formatQuery, intToBcd, scanQuery } from './query';

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

describe('formatQuery', () => {
  it('copies hex digits and skips spaces', () => {
    expect(hex(formatQuery('1806 0201'))).toBe('18 06 02 01');
  });

  it('writes big-endian bytes, words, double and quad words by default', () => {
    expect(hex(formatQuery('%b %w %d', 0x12, 0x3456, 0x789abcde))).toBe('12 34 56 78 9a bc de');
    expect(hex(formatQuery('%q', 0x0102030405060708n))).toBe('01 02 03 04 05 06 07 08');
  });

  it('honours the little-endian override', () => {
    expect(hex(formatQuery('%<w %<d', 0x3456, 0x789abcde))).toBe('56 34 de bc 9a 78');
  });

  it('prefixes buffers with their length: 2 bytes for x, 2 bytes plus a 0 terminator for s, 1 byte for z', () => {
    const data = new Uint8Array([0xaa, 0xbb]);
    expect(hex(formatQuery('%x', data))).toBe('00 02 aa bb');
    expect(hex(formatQuery('%s', data))).toBe('00 03 aa bb 00');
    expect(hex(formatQuery('%z', data))).toBe('02 aa bb');
    expect(hex(formatQuery('%*', data))).toBe('aa bb');
  });

  it('encodes BCD bytes and words', () => {
    expect(hex(formatQuery('%B', 42))).toBe('42');
    // Upstream encodes %W with a 1-byte limit; the port allows the full word.
    expect(hex(formatQuery('%W', 1234))).toBe('12 34');
  });

  it('rejects an unknown format character', () => {
    expect(() => formatQuery('%y', 1)).toThrow(/format char/);
  });
});

describe('scanQuery', () => {
  it('rejects a length-prefixed block shorter than its declared length', () => {
    // %x declares 6 bytes but only 5 follow.
    expect(() => scanQuery(new Uint8Array([0x00, 0x06, 1, 2, 3, 4, 5]), '%x')).toThrow(/shorter/);
  });

  it('matches literal bytes and reads numbers as bigint', () => {
    expect(scanQuery(new Uint8Array([0x18, 0x06, 0x12, 0x34, 0x56]), '1806 %b %w')).toEqual([
      0x12n,
      0x3456n,
    ]);
  });

  it('honours the little-endian override', () => {
    expect(scanQuery(new Uint8Array([0x56, 0x34]), '%<w')).toEqual([0x3456n]);
  });

  it('skips a byte with %? and returns the rest with %*', () => {
    expect(scanQuery(new Uint8Array([0x01, 0x02, 0x03, 0x04]), '%? 02 %*')).toEqual([
      new Uint8Array([0x03, 0x04]),
    ]);
  });

  it('reads length-prefixed buffers', () => {
    expect(scanQuery(new Uint8Array([0x00, 0x02, 0xaa, 0xbb]), '%x')).toEqual([
      new Uint8Array([0xaa, 0xbb]),
    ]);
    expect(scanQuery(new Uint8Array([0x02, 0xaa, 0xbb]), '%z')).toEqual([
      new Uint8Array([0xaa, 0xbb]),
    ]);
  });

  it('decodes BCD', () => {
    expect(scanQuery(new Uint8Array([0x42, 0x12, 0x34]), '%B %W')).toEqual([42, 1234]);
  });

  it('fails on a literal mismatch, naming the position', () => {
    expect(() => scanQuery(new Uint8Array([0x18, 0x07]), '1806')).toThrow(/mismatch at 1/);
  });

  it('fails when bytes are left over', () => {
    expect(() => scanQuery(new Uint8Array([0x18, 0x06, 0xff]), '1806')).toThrow(/remaining/);
  });

  it('round-trips with formatQuery', () => {
    const bytes = formatQuery('00 %w %<d %B', 0x0102, 0x03040506, 99);
    expect(scanQuery(bytes, '00 %w %<d %B')).toEqual([0x0102n, 0x03040506n, 99]);
  });
});

describe('BCD helpers', () => {
  it('converts both ways', () => {
    expect(intToBcd(0)).toBe(0);
    expect(intToBcd(59, 1)).toBe(0x59);
    expect(intToBcd(1234, 2)).toBe(0x1234);
    expect(bcdToInt(0x1234)).toBe(1234);
  });

  it('rejects a value that does not fit', () => {
    expect(() => intToBcd(100, 1)).toThrow(/cannot fit/);
  });
});
