import { FRAMES_PER_SECOND, type Disc, type Track } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { titleForm } from './title-form';

function track(index: number, title = ''): Track {
  return {
    index,
    title,
    fullWidthTitle: '',
    duration: FRAMES_PER_SECOND,
    channel: 0,
    encoding: 0x90,
    flags: 0,
  };
}

function disc(
  tracks: Track[],
  groups: Disc['groups'] = [{ title: null, fullWidthTitle: null, tracks }],
): Disc {
  return {
    title: 'Mix',
    fullWidthTitle: '',
    writable: true,
    writeProtected: false,
    used: 0,
    left: 0,
    total: 0,
    trackCount: tracks.length,
    groups,
  };
}

describe('titleForm', () => {
  it('previews the converted half-width title (disc-editing: "Accented title")', () => {
    const form = titleForm(
      disc([track(0)]),
      { kind: 'track', index: 0 },
      {
        halfWidth: 'Te Lloré un Río',
        fullWidth: '',
      },
    );
    expect(form.halfWidth).toBe('Te Llore un Rio');
    expect(form.halfWidthChanged).toBe(true);
  });

  it('previews spaces for unsupported characters (disc-editing: "Unsupported character")', () => {
    const form = titleForm(disc([track(0)]), { kind: 'disc' }, { halfWidth: 'A★B', fullWidth: '' });
    expect(form.halfWidth).toBe('A B');
  });

  it('keeps full-width titles (disc-editing: "Full-width track title")', () => {
    const form = titleForm(
      disc([track(0)]),
      { kind: 'track', index: 0 },
      { halfWidth: '', fullWidth: '夜明け' },
    );
    expect(form.fullWidth).toBe('夜明け');
  });

  it('shows the space left after the change', () => {
    const form = titleForm(
      disc([track(0, 'Old')]),
      { kind: 'track', index: 0 },
      { halfWidth: 'Intro', fullWidth: '' },
    );
    // Disc entry 'Mix0;//' is 1 cell, the track title 1 cell, of 255 cells of 7 characters.
    expect(form.remaining.halfWidth).toBe((255 - 2) * 7);
    expect(form.fits).toBe(true);
  });

  it('does not fit a title longer than the space left (disc-editing: "Title too long for the disc")', () => {
    const form = titleForm(
      disc([track(0)]),
      { kind: 'track', index: 0 },
      {
        halfWidth: 'x'.repeat(7 * 255),
        fullWidth: '',
      },
    );
    expect(form.fits).toBe(false);
    expect(form.remaining.halfWidth).toBe(0);
  });

  it('counts a new group title against the space', () => {
    const tracks = [track(0), track(1)];
    const form = titleForm(
      disc(tracks),
      { kind: 'new-group', tracks: [0, 1] },
      {
        halfWidth: 'x'.repeat(7 * 254),
        fullWidth: '',
      },
    );
    expect(form.fits).toBe(false);
  });

  it('reports which titles changed from the current ones', () => {
    const form = titleForm(
      disc([track(0, 'Same')]),
      { kind: 'track', index: 0 },
      { halfWidth: 'Same', fullWidth: '' },
    );
    expect(form.halfWidthChanged).toBe(false);
    expect(form.fullWidthChanged).toBe(false);
  });

  it('removes slashes that would read as the group delimiter from disc and group titles', () => {
    const form = titleForm(
      disc([track(0)]),
      { kind: 'disc' },
      { halfWidth: 'AC//DC/', fullWidth: 'エー／／ビー／' },
    );
    expect(form.halfWidth).toBe('AC/DC');
    expect(form.fullWidth).toBe('エー／ビー');
    const group = titleForm(
      disc([track(0), track(1)]),
      { kind: 'new-group', tracks: [0, 1] },
      {
        halfWidth: 'A//B',
        fullWidth: '',
      },
    );
    expect(group.halfWidth).toBe('A/B');
  });

  it('keeps slashes in track titles, which are stored apart from the groups', () => {
    const form = titleForm(
      disc([track(0)]),
      { kind: 'track', index: 0 },
      { halfWidth: 'AC//DC/', fullWidth: '' },
    );
    expect(form.halfWidth).toBe('AC//DC/');
  });

  it('requires a title for a group, so the group stays editable', () => {
    const tracks = [track(0), track(1)];
    expect(
      titleForm(
        disc(tracks),
        { kind: 'new-group', tracks: [0, 1] },
        { halfWidth: '  ', fullWidth: '' },
      ).missingTitle,
    ).toBe(true);
    expect(
      titleForm(
        disc(tracks),
        { kind: 'new-group', tracks: [0, 1] },
        { halfWidth: 'Live', fullWidth: '' },
      ).missingTitle,
    ).toBe(false);
    // A disc or a track may be untitled.
    expect(
      titleForm(disc(tracks), { kind: 'disc' }, { halfWidth: '', fullWidth: '' }).missingTitle,
    ).toBe(false);
  });

  it('does not fit a group the disc title field would leave out', () => {
    // The space balance says it fits, but compiled as "1-2;A//" it no longer does.
    const tracks = [track(0, 'x'.repeat(7 * 253)), track(1)];
    const form = titleForm(
      disc(tracks),
      { kind: 'new-group', tracks: [0, 1] },
      {
        halfWidth: 'A',
        fullWidth: '',
      },
    );
    expect(form.fits).toBe(false);
  });

  it('fits a title that replaces one of the same length on a full disc (disc-editing: "Replacing a title on a full disc")', () => {
    // The disc entry "Mix0;//" (1 cell), "Old" (1) and another title (253) fill all 255 cells.
    const full = disc([track(0, 'Old'), track(1, 'x'.repeat(7 * 253))]);
    expect(
      titleForm(
        full,
        { kind: 'track', index: 1 },
        { halfWidth: 'x'.repeat(7 * 253), fullWidth: '' },
      ).remaining.halfWidth,
    ).toBe(0);
    const form = titleForm(full, { kind: 'track', index: 0 }, { halfWidth: 'New', fullWidth: '' });
    expect(form.fits).toBe(true);
  });

  it('counts the stored group entries when a track rename needs more space', () => {
    // "0;Mix//1-50;A//" is 15 characters, 3 cells; the estimate without the ";" says 2.
    const tracks = Array.from({ length: 50 }, (_, i) =>
      track(i, i === 0 ? 'x'.repeat(7 * 203) : 'a'),
    );
    const grouped = disc(tracks, [{ title: 'A', fullWidthTitle: null, tracks }]);
    // Track titles use 252 cells; renaming track 2 to 8 characters adds one: 256 of 255.
    const form = titleForm(
      grouped,
      { kind: 'track', index: 1 },
      { halfWidth: 'a'.repeat(8), fullWidth: '' },
    );
    expect(form.fits).toBe(false);
  });
});
