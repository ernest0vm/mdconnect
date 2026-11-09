import { Channels, Encoding, FRAMES_PER_SECOND, type Disc, type Track } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { formatDuration, toDiscView } from './disc-view';

const seconds = (s: number) => s * FRAMES_PER_SECOND;

const track = (
  index: number,
  title: string,
  durationS: number,
  encoding = Encoding.sp,
  channel = Channels.stereo,
): Track => ({
  index,
  title,
  fullWidthTitle: '',
  duration: seconds(durationS),
  channel,
  encoding,
  flags: 0,
});

const disc = (overrides: Partial<Disc> = {}): Disc => ({
  title: 'My Disc',
  fullWidthTitle: '',
  writable: true,
  writeProtected: false,
  used: seconds(30 * 60),
  left: seconds(50 * 60),
  total: seconds(80 * 60),
  trackCount: 0,
  groups: [],
  ...overrides,
});

describe('formatDuration', () => {
  it('formats minutes and seconds, rounding frames down, with minutes past 59', () => {
    expect(formatDuration(seconds(205) + 100)).toBe('3:25');
    expect(formatDuration(seconds(9))).toBe('0:09');
    expect(formatDuration(seconds(80 * 60))).toBe('80:00');
  });
});

describe('toDiscView', () => {
  it('shows capacity in minutes and seconds (disc-contents: "Capacity")', () => {
    expect(toDiscView(disc()).capacity).toEqual({ used: '30:00', free: '50:00', total: '80:00' });
  });

  it('derives used time as total minus free, because devices report used time as playback time on long-play discs (disc-contents: "Capacity")', () => {
    // Recorded on an MZ-NE410 with 60 LP4 tracks: used 300:18 (playback), free 2:14, total 80:59.
    const view = toDiscView(
      disc({
        used: seconds(300 * 60 + 18),
        left: seconds(2 * 60 + 14),
        total: seconds(80 * 60 + 59),
      }),
    );
    expect(view.capacity).toEqual({ used: '78:45', free: '2:14', total: '80:59' });
  });

  it('numbers tracks from 1 across groups, in disc order (disc-contents: "Grouped disc")', () => {
    const view = toDiscView(
      disc({
        trackCount: 3,
        groups: [
          { title: null, fullWidthTitle: null, tracks: [track(2, 'Loose', 60)] },
          {
            title: 'Side A',
            fullWidthTitle: null,
            tracks: [track(0, 'One', 60), track(1, 'Two', 60)],
          },
        ],
      }),
    );
    expect(view.groups.map((g) => [g.title, g.tracks.map((t) => t.number)])).toEqual([
      ['Side A', [1, 2]],
      [null, [3]],
    ]);
  });

  it('keeps two adjacent groups apart even when their titles match', () => {
    const view = toDiscView(
      disc({
        groups: [
          { title: 'Live', fullWidthTitle: null, tracks: [track(0, 'a', 60)] },
          { title: 'Live', fullWidthTitle: null, tracks: [track(1, 'b', 60)] },
        ],
      }),
    );
    expect(view.groups.map((g) => [g.title, g.tracks.map((t) => t.number)])).toEqual([
      ['Live', [1]],
      ['Live', [2]],
    ]);
  });

  it('shows the full-width title first and keeps a different half-width title as secondary (disc-contents: "Japanese titles")', () => {
    const view = toDiscView(
      disc({
        title: 'Disc',
        fullWidthTitle: 'ディスク',
        groups: [
          {
            title: 'A',
            fullWidthTitle: 'Ａ面',
            tracks: [
              { ...track(0, 'Test', 60), fullWidthTitle: 'テスト' },
              { ...track(1, 'Same', 60), fullWidthTitle: '' },
            ],
          },
        ],
      }),
    );
    expect([view.title, view.subtitle]).toEqual(['ディスク', 'Disc']);
    expect(view.groups[0]?.title).toBe('Ａ面');
    expect(view.groups[0]?.tracks.map((t) => [t.title, t.subtitle])).toEqual([
      ['テスト', 'Test'],
      ['Same', null],
    ]);
  });

  it('labels the recording mode, adding mono where it applies', () => {
    const view = toDiscView(
      disc({
        groups: [
          {
            title: null,
            fullWidthTitle: null,
            tracks: [
              track(0, 'a', 1, Encoding.sp),
              track(1, 'b', 1, Encoding.sp, Channels.mono),
              track(2, 'c', 1, Encoding.lp2),
              track(3, 'd', 1, Encoding.lp4),
            ],
          },
        ],
      }),
    );
    expect(view.groups[0]?.tracks.map((t) => t.mode)).toEqual(['SP', 'SP mono', 'LP2', 'LP4']);
  });

  it('shows "Untitled" for a missing track title and prefers a full-width title when the half-width one is empty (disc-contents: "Untitled track", "Japanese titles")', () => {
    const view = toDiscView(
      disc({
        title: '',
        fullWidthTitle: 'ディスク',
        groups: [
          {
            title: null,
            fullWidthTitle: null,
            tracks: [track(0, '', 60), { ...track(1, '', 60), fullWidthTitle: 'テスト' }],
          },
        ],
      }),
    );
    expect(view.title).toBe('ディスク');
    expect(view.groups[0]?.tracks.map((t) => [t.title, t.untitled])).toEqual([
      ['Untitled', true],
      ['テスト', false],
    ]);
  });

  it('keeps an untitled disc untitled and reports write protection (disc-contents: "Write-protected disc")', () => {
    const view = toDiscView(disc({ title: '', writeProtected: true }));
    expect(view.title).toBeNull();
    expect(view.writeProtected).toBe(true);
  });

  it('shows a blank disc with no groups and all of its capacity free (disc-contents: "Blank disc")', () => {
    const view = toDiscView(disc({ used: 0, left: seconds(80 * 60) }));
    expect(view.groups).toEqual([]);
    expect(view.capacity.free).toBe('80:00');
  });
});
