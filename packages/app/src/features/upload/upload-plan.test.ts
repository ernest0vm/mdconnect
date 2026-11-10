import { describe, expect, it } from 'vitest';

import { discSecondsFor, fitTitles, timeFit } from './upload-plan';

describe('discSecondsFor', () => {
  it('counts SP at full length, SP mono and LP2 at half, and LP4 at a quarter', () => {
    expect(discSecondsFor(60, 'sp')).toBe(60);
    expect(discSecondsFor(60, 'spMono')).toBe(30);
    expect(discSecondsFor(60, 'lp2')).toBe(30);
    expect(discSecondsFor(60, 'lp105')).toBe(30);
    expect(discSecondsFor(60, 'lp4')).toBe(15);
  });
});

describe('timeFit', () => {
  const tracks = (mode: 'sp' | 'lp2') => [
    { durationSeconds: 900, mode },
    { durationSeconds: 900, mode },
  ];

  it('does not fit 30 minutes of SP in 20 free minutes, but fits them in LP2 (track-upload: "Fits in LP2 but not in SP")', () => {
    expect(timeFit(tracks('sp'), 1200)).toEqual({
      neededSeconds: 1800,
      freeSeconds: 1200,
      fits: false,
    });
    expect(timeFit(tracks('lp2'), 1200)).toEqual({
      neededSeconds: 900,
      freeSeconds: 1200,
      fits: true,
    });
  });

  it('counts a pre-encoded track in its own mode', () => {
    expect(timeFit([{ durationSeconds: 400, mode: 'lp4' }], 100).fits).toBe(true);
  });
});

describe('fitTitles', () => {
  const space = (halfWidth: number, fullWidth = 1000) => ({ halfWidth, fullWidth });

  it('keeps titles that fit', () => {
    const result = fitTitles([{ title: 'One', fullWidthTitle: '' }], space(70), false);
    expect(result).toEqual({ titles: [{ title: 'One', fullWidthTitle: '' }], shortened: false });
  });

  it('shortens titles in order once the space runs out (track-upload: "Title space runs out")', () => {
    // 14 characters: the first title takes 7 cells' worth (one cell), the second gets the rest.
    const result = fitTitles(
      [
        { title: 'Seven c', fullWidthTitle: '' },
        { title: 'Much longer title', fullWidthTitle: '' },
        { title: 'Third', fullWidthTitle: '' },
      ],
      space(14),
      false,
    );
    expect(result.titles.map((t) => t.title)).toEqual(['Seven c', 'Much lo', '']);
    expect(result.shortened).toBe(true);
  });

  it('drops full-width titles when full-width titles are off', () => {
    const result = fitTitles([{ title: 'A', fullWidthTitle: '序曲' }], space(70), false);
    expect(result.titles[0]?.fullWidthTitle).toBe('');
  });

  it('caps a full-width title at 105 characters and at the full-width space', () => {
    const long = 'あ'.repeat(200);
    const result = fitTitles([{ title: '', fullWidthTitle: long }], space(70, 2000), true);
    expect(result.titles[0]?.fullWidthTitle).toHaveLength(105);
    const tight = fitTitles([{ title: '', fullWidthTitle: 'あいうえお' }], space(70, 6), true);
    expect(tight.titles[0]?.fullWidthTitle).toBe('あいう');
    expect(tight.shortened).toBe(true);
  });
});
