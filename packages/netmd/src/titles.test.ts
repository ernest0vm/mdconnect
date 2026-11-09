import { describe, expect, it } from 'vitest';

import { decodeSjis, discDisplayTitle, parseGroups } from './titles';

describe('decodeSjis (disc-contents: "Japanese titles")', () => {
  it('decodes ASCII and Shift-JIS full-width text', () => {
    expect(decodeSjis(new Uint8Array([0x41, 0x42]))).toBe('AB');
    // "テスト" in Shift-JIS.
    expect(decodeSjis(new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]))).toBe('テスト');
  });

  it('decodes half-width kana in half-width titles, which are Shift-JIS too', () => {
    // "ｱｲｳ" (half-width katakana) in Shift-JIS.
    expect(decodeSjis(new Uint8Array([0xb1, 0xb2, 0xb3]))).toBe('ｱｲｳ');
  });
});

describe('discDisplayTitle', () => {
  it('returns a plain title unchanged', () => {
    expect(discDisplayTitle('My Disc', false)).toBe('My Disc');
  });

  it('extracts the title from a grouped raw title', () => {
    expect(discDisplayTitle('0;My Disc//1-2;Side A//', false)).toBe('My Disc');
    expect(discDisplayTitle('1-2;Side A//', false)).toBe('');
    expect(discDisplayTitle('０；ディスク／／１－２；Ａ面／／', true)).toBe('ディスク');
  });
});

describe('parseGroups (disc-contents: "Grouped disc")', () => {
  it('puts every track in an untitled group when the disc has no groups', () => {
    expect(parseGroups('My Disc', '', 3)).toEqual([
      { title: null, fullWidthTitle: null, tracks: [0, 1, 2] },
    ]);
  });

  it('reads ranges and single tracks, with ungrouped tracks first', () => {
    expect(parseGroups('0;Disc//1-2;Side A//4;Bonus//', '', 5)).toEqual([
      { title: null, fullWidthTitle: null, tracks: [2, 4] },
      { title: 'Side A', fullWidthTitle: null, tracks: [0, 1] },
      { title: 'Bonus', fullWidthTitle: null, tracks: [3] },
    ]);
  });

  it('matches full-width group names by range', () => {
    expect(parseGroups('0;Disc//1-2;A//', '０；ディスク／／１－２；Ａ面／／', 2)).toEqual([
      { title: 'A', fullWidthTitle: 'Ａ面', tracks: [0, 1] },
    ]);
  });

  it('clips a range that runs past the last track', () => {
    expect(parseGroups('1-9;All//', '', 3)).toEqual([
      { title: 'All', fullWidthTitle: null, tracks: [0, 1, 2] },
    ]);
  });

  it('keeps a track in its first group when a later group claims it too', () => {
    expect(parseGroups('1-2;A//2-3;B//', '', 3)).toEqual([
      { title: 'A', fullWidthTitle: null, tracks: [0, 1] },
      { title: 'B', fullWidthTitle: null, tracks: [2] },
    ]);
  });

  it('ignores a malformed group entry instead of failing the read', () => {
    expect(parseGroups('3-;Broken//x-y;Bad//1;Good//', '', 2)).toEqual([
      { title: null, fullWidthTitle: null, tracks: [1] },
      { title: 'Good', fullWidthTitle: null, tracks: [0] },
    ]);
  });

  it('returns no groups for a blank disc', () => {
    expect(parseGroups('', '', 0)).toEqual([]);
  });
});
