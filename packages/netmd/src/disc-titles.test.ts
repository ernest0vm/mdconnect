import { describe, expect, it } from 'vitest';

import type { Disc, Group, Track } from './content';
import {
  compileDiscTitles,
  groupsFit,
  remainingTitleSpace,
  titleSpaceBalance,
} from './disc-titles';
import { Encoding } from './interface';

function track(
  index: number,
  title = '',
  fullWidthTitle = '',
  encoding: number = Encoding.sp,
): Track {
  return { index, title, fullWidthTitle, duration: 0, channel: 0, encoding, flags: 0 };
}

function group(title: string | null, tracks: Track[], fullWidthTitle: string | null = null): Group {
  return { title, fullWidthTitle, tracks };
}

function disc(groups: Group[], title = '', fullWidthTitle = ''): Disc {
  const trackCount = groups.reduce((n, g) => n + g.tracks.length, 0);
  return {
    title,
    fullWidthTitle,
    writable: true,
    writeProtected: false,
    used: 0,
    left: 0,
    total: 0,
    trackCount,
    groups,
  };
}

describe('compileDiscTitles', () => {
  it('writes the disc title and each group with its 1-based range', () => {
    const grouped = disc([group(null, [track(2)]), group('Side A', [track(0), track(1)])], 'Mix');
    expect(compileDiscTitles(grouped)).toEqual({
      title: '0;Mix//1-2;Side A//',
      fullWidthTitle: '',
    });
  });

  it('writes a one-track group without a range end', () => {
    expect(compileDiscTitles(disc([group('Solo', [track(0)])])).title).toBe('1;Solo//');
  });

  it('keeps only the plain disc title when there are no groups', () => {
    expect(compileDiscTitles(disc([group(null, [track(0)])], 'Mix', '夜'))).toEqual({
      title: 'Mix',
      fullWidthTitle: '夜',
    });
  });

  it('writes full-width groups when any title is full-width', () => {
    const japanese = disc([group('A', [track(0), track(1)], 'エー')], 'Night', '夜');
    expect(compileDiscTitles(japanese)).toEqual({
      title: '0;Night//1-2;A//',
      fullWidthTitle: '０；夜／／１－２；エー／／',
    });
  });

  it('drops groups that no longer fit in the title space (disc-editing: "Title too long for the disc")', () => {
    const full = disc([group('G', [track(0, 'x'.repeat(7 * 254))])]);
    expect(compileDiscTitles(full).title).toBe('');
  });
});

describe('remainingTitleSpace', () => {
  it('counts a one-track group by its single number', () => {
    const solo = disc([group('Solo', [track(0, 'A')])], 'Mix');
    // 'Mix0;//Solo1//' takes 2 cells and the track title 1, of 255 cells of 7 characters.
    expect(remainingTitleSpace(solo)).toEqual({
      halfWidth: (255 - 3) * 7,
      fullWidth: (255 - 2) * 7,
    });
  });

  it('reserves a cell for the long-play prefix of untitled LP tracks', () => {
    const lp = disc([group(null, [track(0, '', '', Encoding.lp2)])]);
    expect(remainingTitleSpace(lp)).toEqual({ halfWidth: (255 - 2) * 7, fullWidth: (255 - 3) * 7 });
  });

  it('never reports negative space', () => {
    const full = disc([group(null, [track(0, 'x'.repeat(7 * 300))])]);
    expect(remainingTitleSpace(full).halfWidth).toBe(0);
  });
});

describe('titleSpaceBalance', () => {
  it('reports how far titles overflow the disc', () => {
    const full = disc([group(null, [track(0, 'x'.repeat(7 * 256))])]);
    // 256 cells for the track and 1 for the empty disc entry, of 255.
    expect(titleSpaceBalance(full).halfWidth).toBe(-2 * 7);
  });
});

describe('groupsFit', () => {
  it('is true when every group and the disc title survive compilation', () => {
    expect(
      groupsFit(disc([group(null, [track(2)]), group('Side A', [track(0), track(1)])], 'Mix')),
    ).toBe(true);
  });

  it('is false when the compiler would leave a group out', () => {
    // 253 cells of track titles leave too little room for "1-10;A//" once compiled.
    const tracks = Array.from({ length: 10 }, (_, i) =>
      track(i, i === 0 ? 'x'.repeat(7 * 253) : ''),
    );
    expect(groupsFit(disc([group('A', tracks)]))).toBe(false);
  });

  it('is true for a disc without groups', () => {
    expect(groupsFit(disc([group(null, [track(0)])], 'Mix'))).toBe(true);
  });
});
