import { FRAMES_PER_SECOND, type Disc, type Track } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { fullWidthTitleFor, reviewNewTitles } from './apply-titles';

function track(index: number, title = '', fullWidthTitle = ''): Track {
  return {
    index,
    title,
    fullWidthTitle,
    duration: 180 * FRAMES_PER_SECOND,
    channel: 0,
    encoding: 0x90,
    flags: 0,
  };
}

function disc(tracks: Track[], options: Partial<Disc> = {}): Disc {
  return {
    title: 'Mix',
    fullWidthTitle: '',
    writable: true,
    writeProtected: false,
    used: 0,
    left: 0,
    total: 0,
    trackCount: tracks.length,
    groups: [{ title: null, fullWidthTitle: null, tracks }],
    ...options,
  };
}

const on = { fullWidth: true };

describe('reviewNewTitles', () => {
  it('changes only the ticked titles (song-recognition: "Apply")', () => {
    const review = reviewNewTitles(
      disc([track(0, 'A'), track(1, 'B'), track(2, 'C')]),
      [
        { index: 1, raw: 'Dawn' },
        { index: 2, raw: 'Dusk' },
      ],
      on,
    );
    expect(review.blocker).toBeNull();
    expect(review.plan.commands).toEqual([
      { kind: 'setTrackTitle', track: 1, title: 'Dawn', fullWidth: false },
      { kind: 'setTrackTitle', track: 2, title: 'Dusk', fullWidth: false },
    ]);
  });

  it('shows the converted title (song-recognition: "Accented title")', () => {
    const review = reviewNewTitles(disc([track(0)]), [{ index: 0, raw: 'Te Lloré un Río' }], on);
    expect(review.titles).toEqual([{ index: 0, halfWidth: 'Te Llore un Rio', fullWidth: '' }]);
  });

  it('keeps the groups as they are (song-recognition: "Groups unchanged")', () => {
    const tracks = [track(0), track(1), track(2), track(3), track(4)];
    const grouped = disc(tracks, {
      groups: [
        { title: 'Side A', fullWidthTitle: null, tracks: tracks.slice(0, 3) },
        { title: null, fullWidthTitle: null, tracks: tracks.slice(3) },
      ],
    });
    const review = reviewNewTitles(grouped, [{ index: 4, raw: 'Dawn' }], on);
    expect(review.plan.commands).toEqual([
      { kind: 'setTrackTitle', track: 4, title: 'Dawn', fullWidth: false },
    ]);
  });

  it('clears an old full-width title (song-recognition: "Old full-width title cleared")', () => {
    const review = reviewNewTitles(
      disc([track(0), track(1), track(2), track(3, 'x', '夜明け')]),
      [{ index: 3, raw: 'Dawn' }],
      on,
    );
    expect(review.plan.commands).toEqual([
      { kind: 'setTrackTitle', track: 3, title: 'Dawn', fullWidth: false },
      { kind: 'setTrackTitle', track: 3, title: '', fullWidth: true },
    ]);
  });

  it('is unavailable on a write-protected disc (song-recognition: "Write-protected disc")', () => {
    const review = reviewNewTitles(
      disc([track(0)], { writeProtected: true }),
      [{ index: 0, raw: 'Dawn' }],
      on,
    );
    expect(review.blocker).toBe('The disc is write-protected. Slide its tab to edit it.');
  });

  it('is unavailable when the titles do not fit', () => {
    const review = reviewNewTitles(disc([track(0)]), [{ index: 0, raw: 'x'.repeat(2000) }], on);
    expect(review.fits).toBe(false);
    expect(review.blocker).toBe('The new titles do not fit in the disc’s title space.');
  });

  it('refuses a title with nothing the disc can store', () => {
    const review = reviewNewTitles(disc([track(0, 'Old')]), [{ index: 0, raw: '😀' }], on);
    expect(review.blocker).toBe('Track 1’s new title has no character the disc can store.');
  });

  it('has nothing to apply when the titles are already on the disc', () => {
    const review = reviewNewTitles(disc([track(0, 'Dawn')]), [{ index: 0, raw: 'Dawn' }], on);
    expect(review.plan.commands).toEqual([]);
    expect(review.blocker).toBe('The disc already has these titles.');
  });

  it('asks for a ticked title when there is none', () => {
    expect(reviewNewTitles(disc([track(0)]), [], on).blocker).toBe(
      'Tick a track that has a new title.',
    );
  });
});

describe('fullWidthTitleFor', () => {
  it('saves kanji and kana as the full-width title (song-recognition: "Full-width title")', () => {
    expect(fullWidthTitleFor('夜明け', true)).toBe('夜明け');
    expect(fullWidthTitleFor('けさ', true)).toBe('けさ');
    expect(fullWidthTitleFor('♪', true)).toBe('♪');
  });

  it('saves none for what the half-width title holds (song-recognition: "Full-width letters only", "Full-width space", "Accents only")', () => {
    for (const title of [
      'Dawn',
      'ＡＢＣ',
      'Ａ　Ｂ',
      '「Ａ」',
      'カタカナ',
      'Te Lloré un Río',
      'Björk',
    ]) {
      expect(fullWidthTitleFor(title, true)).toBe('');
    }
  });

  it('converts a Japanese title with an unsupported character as renaming does (song-recognition: "Unsupported character in a Japanese title")', () => {
    expect(fullWidthTitleFor('夜明け😀', true)).toBe('');
  });

  it('saves none when full-width titles are off', () => {
    expect(fullWidthTitleFor('夜明け', false)).toBe('');
  });
});
