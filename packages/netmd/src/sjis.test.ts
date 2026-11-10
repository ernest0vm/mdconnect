import { describe, expect, it } from 'vitest';

import { decodeSjis } from './titles';
import { encodeSjis, isSjisEncodable } from './sjis';

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

describe('encodeSjis', () => {
  it('encodes ASCII as single bytes', () => {
    expect(hex(encodeSjis('Abc 1/2'))).toBe('41626320312f32');
  });

  it('encodes half-width katakana as single bytes', () => {
    expect(hex(encodeSjis('ｱｶﾞ'))).toBe('b1b6de');
  });

  it('encodes full-width characters as two bytes', () => {
    expect(hex(encodeSjis('夜明け'))).toBe('96e996be82af');
    expect(hex(encodeSjis('０；'))).toBe('824f8147');
  });

  it('round-trips through the decoder', () => {
    const text = 'Mix ｱｲｳ 夜明け ＡＢＣ ・「」';
    expect(decodeSjis(encodeSjis(text))).toBe(text);
  });

  it('reports characters Shift-JIS cannot store', () => {
    expect(isSjisEncodable('Rio')).toBe(true);
    expect(isSjisEncodable('Río')).toBe(false);
    expect(isSjisEncodable('★')).toBe(true);
    expect(isSjisEncodable('😀')).toBe(false);
  });

  it('throws instead of writing a replacement byte', () => {
    expect(() => encodeSjis('é')).toThrow(/é/u);
  });
});
