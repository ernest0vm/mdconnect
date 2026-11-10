import { FRAMES_PER_SECOND, type Disc } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import {
  addTracksBlocker,
  audioFiles,
  fitView,
  initialMode,
  moveItem,
  preparedTitles,
  progressAfter,
  startingProgress,
  recordingModes,
  removeItem,
  retitle,
  skippedLine,
  skipReasonText,
  summaryText,
  uploadModeOf,
  type ConvertItem,
} from './upload-view';

const named = (name: string, type = '') => new File([new Uint8Array(1)], name, { type });

const disc = (freeMinutes: number): Disc => ({
  title: '',
  fullWidthTitle: '',
  writable: true,
  writeProtected: false,
  used: 0,
  left: freeMinutes * 60 * FRAMES_PER_SECOND,
  total: 80 * 60 * FRAMES_PER_SECOND,
  trackCount: 0,
  groups: [],
});

const item = (overrides: Partial<ConvertItem> = {}): ConvertItem => ({
  id: 1,
  file: named('a.mp3'),
  tags: {},
  durationSeconds: 60,
  atrac: null,
  problem: null,
  title: 'a',
  fullWidthTitle: '',
  edited: false,
  ...overrides,
});

describe('audioFiles', () => {
  it('keeps audio files and names the others (track-upload: "Files that are not audio")', () => {
    const result = audioFiles([
      named('notes.txt', 'text/plain'),
      named('a.mp3', 'audio/mpeg'),
      named('b.FLAC'),
      named('c.oma'),
      named('clip.mp4', 'video/mp4'),
    ]);
    expect(result.accepted.map((f) => f.name)).toEqual(['a.mp3', 'b.FLAC', 'c.oma', 'clip.mp4']);
    expect(result.rejected).toEqual(['notes.txt']);
  });
});

describe('addTracksBlocker', () => {
  it('blocks a write-protected disc (track-upload: "Write-protected disc")', () => {
    expect(addTracksBlocker({ writeProtected: true, busy: false })).toMatch(/write-protected/);
  });

  it('blocks while a change is saved or an upload runs', () => {
    expect(addTracksBlocker({ writeProtected: false, busy: true })).toMatch(/Wait/);
  });

  it('allows adding tracks otherwise', () => {
    expect(addTracksBlocker({ writeProtected: false, busy: false })).toBeNull();
  });
});

describe('recordingModes', () => {
  it('offers SP, LP2 and LP4 on the MZ-NE410 (track-upload: "Deck without native mono")', () => {
    expect(recordingModes(0x054c, 0x00ca)).toEqual(['sp', 'lp2', 'lp4']);
  });

  it('adds SP mono on a deck that records it natively (track-upload: "Deck with native mono")', () => {
    expect(recordingModes(0x054c, 0x0081)).toEqual(['sp', 'spMono', 'lp2', 'lp4']);
  });

  it('starts on the remembered mode, or SP when it is not offered (track-upload: "Remembered mode")', () => {
    expect(initialMode('lp2', ['sp', 'lp2', 'lp4'])).toBe('lp2');
    expect(initialMode('spMono', ['sp', 'lp2', 'lp4'])).toBe('sp');
  });
});

describe('list editing', () => {
  const list = [
    item({ id: 1, title: 'a' }),
    item({ id: 2, title: 'b' }),
    item({ id: 3, title: 'c' }),
  ];

  it('moves a track up or down (track-upload: "Reorder")', () => {
    expect(moveItem(list, 1, -1).map((i) => i.title)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 2, 1)).toBe(list);
  });

  it('removes a track (track-upload: "Remove the last track")', () => {
    expect(removeItem(list, 0).map((i) => i.title)).toEqual(['b', 'c']);
  });

  it('retitles tracks from a new source, but keeps titles the user typed', () => {
    const tagged = [
      item({ id: 1, file: named('01.mp3'), tags: { title: 'Intro', artist: 'Band' } }),
      item({ id: 2, file: named('02.mp3'), tags: { title: 'Outro' }, title: 'Mine', edited: true }),
    ];
    expect(retitle(tagged, 'artist-title').map((i) => i.title)).toEqual(['Band - Intro', 'Mine']);
  });
});

describe('uploadModeOf', () => {
  it("uses a pre-encoded file's own mode, otherwise the chosen one", () => {
    expect(uploadModeOf(item({ atrac: 'lp2' }), 'lp4')).toBe('lp2');
    expect(uploadModeOf(item(), 'lp4')).toBe('lp4');
  });
});

describe('fitView', () => {
  const thirty = [item({ id: 1, durationSeconds: 900 }), item({ id: 2, durationSeconds: 900 })];

  it('refuses SP but allows LP2 for 30 minutes on a disc with 20 free (track-upload: "Fits in LP2 but not in SP")', () => {
    const sp = fitView(thirty, 'sp', disc(20), false);
    expect(sp.canUpload).toBe(false);
    expect(sp.reason).toMatch(/do not fit/);
    expect(sp.text).toBe('30:00 needed of 20:00 free');
    expect(fitView(thirty, 'lp2', disc(20), false).canUpload).toBe(true);
  });

  it('counts a pre-encoded file in its own mode (track-upload: "Pre-encoded LP4 file with SP chosen")', () => {
    const view = fitView([item({ durationSeconds: 2400, atrac: 'lp4' })], 'sp', disc(15), false);
    expect(view.canUpload).toBe(true);
    expect(view.text).toBe('10:00 needed of 15:00 free');
  });

  it('waits while a duration is still being measured (track-upload: "Unknown duration")', () => {
    const view = fitView([item({ durationSeconds: null, tags: null })], 'sp', disc(80), false);
    expect(view.canUpload).toBe(false);
    expect(view.reason).toMatch(/Reading/);
  });

  it('needs at least one track to upload', () => {
    expect(fitView([], 'sp', disc(80), false).canUpload).toBe(false);
  });

  it('warns when titles will be shortened but still allows the upload (track-upload: "Title space runs out")', () => {
    const full: Disc = { ...disc(80), title: 'x'.repeat(1760) };
    const view = fitView([item({ title: 'A long title for this track' })], 'sp', full, false);
    expect(view.canUpload).toBe(true);
    expect(view.titlesShortened).toBe(true);
  });
});

describe('preparedTitles', () => {
  it('converts titles for the disc and keeps full-width titles only when enabled', () => {
    const items = [item({ title: 'Café', fullWidthTitle: '序曲' })];
    expect(preparedTitles(items, disc(80), false)).toEqual([{ title: 'Cafe', fullWidthTitle: '' }]);
    expect(preparedTitles(items, disc(80), true)[0]?.fullWidthTitle).toBe('序曲');
  });
});

describe('result messages', () => {
  it('writes a line for a track skipped before the upload', () => {
    expect(skippedLine('Demo', 'not-decodable')).toBe('Skipped “Demo”: it could not be decoded.');
  });

  it('explains each skip reason', () => {
    expect(skipReasonText('not-decodable')).toBe('it could not be decoded');
    expect(skipReasonText('online-encoder-unavailable')).toBe(
      'the online encoder is not available',
    );
  });

  it('summarises uploaded, skipped and not uploaded tracks', () => {
    const titles = ['One', 'Two', 'Three', 'Four'];
    expect(
      summaryText(
        {
          uploaded: [0],
          skipped: [{ index: 1, reason: 'not-decodable' }],
          notUploaded: [2, 3],
          cancelled: false,
          failure: new Error('x'),
        },
        titles,
      ),
    ).toEqual([
      '1 track uploaded.',
      'Skipped “Two”: it could not be decoded.',
      'Not uploaded because the device stopped answering or refused the track: “Three”, “Four”.',
    ]);
    expect(
      summaryText(
        { uploaded: [0, 1], skipped: [], notUploaded: [2], cancelled: true, failure: null },
        titles,
      ),
    ).toEqual(['2 tracks uploaded.', 'Cancelled before “Three”.']);
  });
});

describe('progressAfter', () => {
  const titles = ['One', 'Two'];

  it('follows conversion and transfer, then fills the bar when a track is done (track-upload: "Progress shown")', () => {
    let progress = startingProgress(titles);
    progress = progressAfter(progress, { kind: 'converting', index: 1, progress: 0.5 }, titles);
    expect(progress.converting).toBe(0.5);
    progress = progressAfter(
      progress,
      { kind: 'transferring', index: 1, writtenBytes: 10, totalBytes: 40 },
      titles,
    );
    expect(progress).toMatchObject({ index: 1, title: 'Two', writtenBytes: 10, totalBytes: 40 });
    progress = progressAfter(progress, { kind: 'uploaded', index: 1, track: 5 }, titles);
    expect(progress.writtenBytes).toBe(40);
    expect(progressAfter(progress, { kind: 'skipped', index: 0, reason: 'empty' }, titles)).toBe(
      progress,
    );
  });
});
