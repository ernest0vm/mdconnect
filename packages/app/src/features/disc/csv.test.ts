import { Encoding, FRAMES_PER_SECOND, type Disc, type Track } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { csvFileName, formatCsv, importPlan, parseCsv, reviewImport } from './csv';

const SP: number = Encoding.sp;
const LP2: number = Encoding.lp2;

function track(index: number, title: string, seconds: number, encoding = SP, channel = 0): Track {
  return {
    index,
    title,
    fullWidthTitle: '',
    duration: seconds * FRAMES_PER_SECOND,
    channel,
    encoding,
    flags: 0,
  };
}

const intro = track(0, 'Intro', 60);
const love = track(1, 'Love, Actually', 125);
const outro = track(2, 'Outro', 90, LP2);
const tracks = [intro, love, outro];
const grouped: Disc = {
  title: 'Mix',
  fullWidthTitle: '',
  writable: true,
  writeProtected: false,
  used: 275 * FRAMES_PER_SECOND,
  left: 0,
  total: 0,
  trackCount: 3,
  groups: [
    { title: null, fullWidthTitle: null, tracks: [outro] },
    { title: 'Side A', fullWidthTitle: null, tracks: [intro, love] },
  ],
};

const HEADER =
  'INDEX,GROUP RANGE,GROUP NAME,GROUP FULL WIDTH NAME,NAME,FULL WIDTH NAME,HIMD ALBUM,HIMD ARTIST,DURATION,ENCODING,BITRATE';

describe('formatCsv (disc-csv: "Export a grouped disc", "Commas in titles")', () => {
  it("writes webminidisc's columns, with zero-based group ranges and escaped commas", () => {
    expect(formatCsv(grouped).split('\n')).toEqual([
      HEADER,
      '0,0-0,,,Mix,,,,275,,',
      '3,,,,Outro,,,,90,AT3,132',
      '1,0-1,Side A,,Intro,,,,60,SPS,292',
      '2,0-1,Side A,,Love\\, Actually,,,,125,SPS,292',
    ]);
  });

  it('names the file after the disc title', () => {
    expect(csvFileName(grouped)).toBe('Mix.csv');
    expect(csvFileName({ ...grouped, fullWidthTitle: '夜' })).toBe('Mix (夜).csv');
    expect(csvFileName({ ...grouped, title: '' })).toBe('Disc.csv');
  });
});

describe('parseCsv', () => {
  it('reads back what formatCsv writes', () => {
    const parsed = parseCsv(formatCsv(grouped));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.rows.map((r) => [r.index, r.groupRange, r.name])).toEqual([
      [0, '0-0', 'Mix'],
      [3, '', 'Outro'],
      [1, '0-1', 'Intro'],
      [2, '0-1', 'Love, Actually'],
    ]);
  });

  it('reads the older 8-column format (disc-csv: "Older format")', () => {
    const old = [
      'INDEX,GROUP RANGE,GROUP NAME,GROUP FULL WIDTH NAME,NAME,FULL WIDTH NAME,DURATION,ENCODING',
      '0,0-0,,,Mix,,275,',
      '1,,,,Intro,,60,SPS',
    ].join('\n');
    const parsed = parseCsv(old);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.rows[1]).toMatchObject({
      index: 1,
      name: 'Intro',
      duration: 60,
      codec: 'SPS',
      bitrate: '',
    });
  });

  it('accepts the plain album and artist header names', () => {
    const text = `${HEADER.replace('HIMD ALBUM', 'ALBUM').replace('HIMD ARTIST', 'ARTIST')}\n0,0-0,,,Mix,,,,0,,`;
    expect('error' in parseCsv(text)).toBe(false);
  });

  it('refuses a file without a supported header (disc-csv: "Not a supported file")', () => {
    expect(parseCsv('name,artist\nfoo,bar')).toEqual({ error: 'unsupported' });
    expect(parseCsv('')).toEqual({ error: 'empty' });
  });
});

describe('reviewImport', () => {
  const parse = (text: string) => {
    const parsed = parseCsv(text);
    if ('error' in parsed) throw new Error(parsed.error);
    return parsed;
  };

  it('finds no differences for a file from the same disc (disc-csv: "Import onto a matching disc")', () => {
    expect(reviewImport(parse(formatCsv(grouped)), grouped)).toEqual({
      fileTracks: 3,
      discTracks: 3,
      mismatches: [],
      outside: [],
    });
  });

  it('reports a different track count and the rows past the disc (disc-csv: "Different track count")', () => {
    const extra = `${formatCsv(grouped)}\n4,,,,Bonus,,,,30,SPS,292`;
    expect(reviewImport(parse(extra), grouped)).toMatchObject({
      fileTracks: 4,
      discTracks: 3,
      outside: [4],
    });
  });

  it('lists a track whose duration or mode differs (disc-csv: "Mismatched track")', () => {
    const changed = formatCsv(grouped).replace(
      '3,,,,Outro,,,,90,AT3,132',
      '3,,,,Outro,,,,240,SPS,292',
    );
    expect(reviewImport(parse(changed), grouped).mismatches).toEqual([
      { track: 3, file: '4:00 SP', disc: '1:30 LP2' },
    ]);
  });

  it('lists a track whose duration is missing, as webminidisc does', () => {
    const missing = formatCsv(grouped).replace('Outro,,,,90,', 'Outro,,,,,');
    expect(reviewImport(parse(missing), grouped).mismatches).toEqual([
      { track: 3, file: 'no duration LP2', disc: '1:30 LP2' },
    ]);
  });

  it('accepts a duration within 2 seconds', () => {
    const close = formatCsv(grouped).replace('Outro,,,,90,', 'Outro,,,,91,');
    expect(reviewImport(parse(close), grouped).mismatches).toEqual([]);
  });
});

describe('importPlan', () => {
  const parse = (text: string) => {
    const parsed = parseCsv(text);
    if ('error' in parsed) throw new Error(parsed.error);
    return parsed;
  };
  const ungrouped: Disc = {
    ...grouped,
    title: '',
    groups: [
      { title: null, fullWidthTitle: null, tracks: tracks.map((t) => ({ ...t, title: '' })) },
    ],
  };

  it('renames the tracks, the disc and the groups from the file', () => {
    const plan = importPlan(parse(formatCsv(grouped)), ungrouped, new Set());
    expect(plan.commands.filter((c) => c.kind === 'setTrackTitle')).toHaveLength(3);
    expect(plan.expected.title).toBe('Mix');
    expect(plan.expected.groups.map((g) => [g.title, g.tracks.map((t) => t.index)])).toEqual([
      [null, [2]],
      ['Side A', [0, 1]],
    ]);
    expect(plan.commands.at(-1)?.kind).toBe('rewriteGroups');
    expect(plan.fits).toBe(true);
  });

  it('leaves skipped tracks as they are (disc-csv: "Skipped track")', () => {
    const plan = importPlan(parse(formatCsv(grouped)), ungrouped, new Set([3]));
    expect(plan.commands.flatMap((c) => (c.kind === 'setTrackTitle' ? [c.track] : []))).toEqual([
      0, 1,
    ]);
  });

  it('converts titles to what the disc can store', () => {
    const accented = formatCsv(grouped).replace('Intro', 'Intró');
    const plan = importPlan(parse(accented), ungrouped, new Set());
    expect(plan.commands).toContainEqual({
      kind: 'setTrackTitle',
      track: 0,
      title: 'Intro',
      fullWidth: false,
    });
  });

  it('does not fit when the titles need more space than the disc has (disc-csv: "Too many characters")', () => {
    const long = formatCsv(grouped).replace('Intro', 'x'.repeat(7 * 260));
    expect(importPlan(parse(long), ungrouped, new Set()).fits).toBe(false);
  });
});
