/*
 * Titles as CSV, in the format webminidisc writes and reads (src/redux/actions.ts, `exportCSV`
 * and `importCSV`, https://github.com/asivery/webminidisc, GPL-2.0), so files move between the
 * two apps. Durations are seconds, rounded up; group ranges are zero-based first and last indexes;
 * commas inside values are written `\,`.
 */
import {
  Channels,
  Encoding,
  FRAMES_PER_SECOND,
  groupsFit,
  sanitizeFullWidthTitle,
  sanitizeHalfWidthTitle,
  titleSpaceBalance,
  type Disc,
  type Group,
  type Track,
} from '@mdconnect/netmd';

import type { EditCommand, LayoutPlan } from './edit-plan';
import { formatDuration } from './disc-view';
import { withoutDelimiters } from './title-form';

const HEADER = [
  'INDEX',
  'GROUP RANGE',
  'GROUP NAME',
  'GROUP FULL WIDTH NAME',
  'NAME',
  'FULL WIDTH NAME',
  'HIMD ALBUM',
  'HIMD ARTIST',
  'DURATION',
  'ENCODING',
  'BITRATE',
] as const;
/** Header names webminidisc also accepts in a column. */
const ALTERNATIVES: Readonly<Record<string, string>> = {
  ALBUM: 'HIMD ALBUM',
  ARTIST: 'HIMD ARTIST',
};
/** webminidisc's older format: no album, artist or bitrate. */
const OLD_HEADER = [
  'INDEX',
  'GROUP RANGE',
  'GROUP NAME',
  'GROUP FULL WIDTH NAME',
  'NAME',
  'FULL WIDTH NAME',
  'DURATION',
  'ENCODING',
];

const SP: number = Encoding.sp;
const LP2: number = Encoding.lp2;
const MONO: number = Channels.mono;

/** webminidisc's codec and bitrate for a track's recording mode. */
function encodingOf(track: Track): { codec: string; bitrate: string } {
  if (track.encoding === SP) {
    return track.channel === MONO
      ? { codec: 'SPM', bitrate: '146' }
      : { codec: 'SPS', bitrate: '292' };
  }
  return { codec: 'AT3', bitrate: track.encoding === LP2 ? '132' : '66' };
}

/** A readable mode for a codec and bitrate, as in the track list. */
function modeName(codec: string, bitrate: string): string {
  const upper = codec.toUpperCase();
  if (upper === 'SPS') return 'SP';
  if (upper === 'SPM') return 'SP mono';
  if (upper === 'AT3') return bitrate === '66' ? 'LP4' : bitrate === '132' ? 'LP2' : 'LP';
  return codec;
}

const seconds = (frames: number) => Math.ceil(frames / FRAMES_PER_SECOND);
const escape = (value: string) => value.replace(/,/gu, '\\,');

/** The disc's titles and groups as webminidisc's CSV. */
export function formatCsv(disc: Disc): string {
  const rows: string[][] = [
    [
      '0',
      '0-0',
      '',
      '',
      disc.title,
      disc.fullWidthTitle,
      '',
      '',
      String(seconds(disc.used)),
      '',
      '',
    ],
  ];
  for (const group of disc.groups) {
    const indexes = group.tracks.map((t) => t.index);
    const range =
      group.title === null ? '' : `${String(Math.min(...indexes))}-${String(Math.max(...indexes))}`;
    for (const track of group.tracks) {
      const { codec, bitrate } = encodingOf(track);
      rows.push([
        String(track.index + 1),
        range,
        group.title ?? '',
        group.fullWidthTitle ?? '',
        track.title,
        track.fullWidthTitle,
        '',
        '',
        String(seconds(track.duration)),
        codec,
        bitrate,
      ]);
    }
  }
  return [[...HEADER], ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

/** The file name webminidisc uses: the disc title, with the full-width one in brackets. */
export function csvFileName(disc: Disc): string {
  if (disc.title !== '') {
    return `${disc.title}${disc.fullWidthTitle === '' ? '' : ` (${disc.fullWidthTitle})`}.csv`;
  }
  return `${disc.fullWidthTitle === '' ? 'Disc' : disc.fullWidthTitle}.csv`;
}

export interface CsvRow {
  /** 1-based track index; 0 is the disc. */
  readonly index: number;
  readonly groupRange: string;
  readonly groupName: string;
  readonly groupFullWidthName: string;
  readonly name: string;
  readonly fullWidthName: string;
  /** Seconds. */
  readonly duration: number;
  readonly codec: string;
  readonly bitrate: string;
}

export type ParsedCsv =
  { readonly rows: readonly CsvRow[] } | { readonly error: 'empty' | 'unsupported' };

/** Splits a line on commas that are not escaped, then unescapes them. */
function cells(line: string): string[] {
  return line.split(/(?<!\\),/u).map((cell) => cell.replace(/\\,/gu, ','));
}

/** Reads webminidisc's CSV, current or older format. */
export function parseCsv(text: string): ParsedCsv {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const [headerLine, ...rest] = lines;
  if (headerLine === undefined) return { error: 'empty' };
  const header = cells(headerLine).map((name) => ALTERNATIVES[name] ?? name);
  const old =
    header.length === OLD_HEADER.length && header.every((name, i) => name === OLD_HEADER[i]);
  const current = header.length === HEADER.length && header.every((name, i) => name === HEADER[i]);
  if (!old && !current) return { error: 'unsupported' };

  const rows = rest.map((line): CsvRow => {
    const c = cells(line);
    const at = (i: number) => c[i] ?? '';
    const [duration, codec, bitrate] = old ? [at(6), at(7), ''] : [at(8), at(9), at(10)];
    return {
      index: Number.parseInt(at(0), 10),
      groupRange: at(1).replace(/ /gu, ''),
      groupName: at(2),
      groupFullWidthName: at(3),
      name: at(4),
      fullWidthName: at(5),
      duration: Number.parseInt(duration, 10),
      codec,
      bitrate,
    };
  });
  return { rows: rows.filter((row) => !Number.isNaN(row.index)) };
}

export interface ImportReview {
  readonly fileTracks: number;
  readonly discTracks: number;
  /** Tracks whose duration or mode differ, described as "m:ss MODE". */
  readonly mismatches: readonly { track: number; file: string; disc: string }[];
  /** 1-based tracks in the file that the disc does not have; they are ignored. */
  readonly outside: readonly number[];
}

const tracksOf = (disc: Disc) =>
  disc.groups.flatMap((g) => g.tracks).sort((a, b) => a.index - b.index);

/**
 * What an import would change that needs the user's attention: a different track count, and
 * tracks whose duration differs by 2 s or more or whose mode differs (webminidisc's checks).
 */
export function reviewImport(parsed: { rows: readonly CsvRow[] }, disc: Disc): ImportReview {
  const discTracks = tracksOf(disc);
  const trackRows = parsed.rows.filter((row) => row.index > 0);
  const mismatches: ImportReview['mismatches'][number][] = [];
  const outside: number[] = [];
  for (const row of trackRows) {
    const track = discTracks[row.index - 1];
    if (track === undefined) {
      outside.push(row.index);
      continue;
    }
    const actual = encodingOf(track);
    const sameMode =
      row.codec.toLowerCase() === actual.codec.toLowerCase() &&
      (row.bitrate === '' || row.bitrate === actual.bitrate);
    if (Math.abs(seconds(track.duration) - row.duration) >= 2 || !sameMode) {
      mismatches.push({
        track: row.index,
        file: `${formatDuration(row.duration * FRAMES_PER_SECOND)} ${modeName(row.codec, row.bitrate)}`,
        disc: `${formatDuration(track.duration)} ${modeName(actual.codec, actual.bitrate)}`,
      });
    }
  }
  return { fileTracks: trackRows.length, discTracks: discTracks.length, mismatches, outside };
}

/** The zero-based first and last index of a group range, clipped to the disc, or null. */
function parseRange(range: string, trackCount: number): [number, number] | null {
  const [first, last] = range.split('-').map((n) => Number.parseInt(n, 10));
  if (first === undefined || Number.isNaN(first)) return null;
  const end = Math.min(last === undefined || Number.isNaN(last) ? first : last, trackCount - 1);
  return first >= 0 && first <= end ? [first, end] : null;
}

/**
 * The edit that applies a file's titles and groups to the disc. Skipped tracks (1-based) and
 * tracks the disc does not have are left out. Titles are converted to what the disc can store.
 */
export function importPlan(
  parsed: { rows: readonly CsvRow[] },
  disc: Disc,
  skipped: ReadonlySet<number>,
): LayoutPlan {
  const discTracks = tracksOf(disc);
  const kept = parsed.rows.filter(
    (row) => row.index > 0 && discTracks[row.index - 1] !== undefined && !skipped.has(row.index),
  );
  const commands: EditCommand[] = [];
  const renamed = discTracks.map((track) => {
    const row = kept.find((r) => r.index === track.index + 1);
    if (row === undefined) return track;
    const title = sanitizeHalfWidthTitle(row.name);
    const fullWidthTitle = sanitizeFullWidthTitle(row.fullWidthName);
    if (title !== track.title) {
      commands.push({ kind: 'setTrackTitle', track: track.index, title, fullWidth: false });
    }
    if (fullWidthTitle !== track.fullWidthTitle) {
      commands.push({
        kind: 'setTrackTitle',
        track: track.index,
        title: fullWidthTitle,
        fullWidth: true,
      });
    }
    return { ...track, title, fullWidthTitle };
  });

  // Groups from the file, in order, without overlaps.
  const owner = new Map<number, number>();
  const groups: Group[] = [];
  for (const row of kept) {
    if (row.groupRange === '' || owner.has(row.index - 1)) continue;
    const range = parseRange(row.groupRange, discTracks.length);
    if (range === null) continue;
    const [first, last] = range;
    const members = renamed.slice(first, last + 1);
    if (members.some((t) => owner.has(t.index))) continue;
    for (const t of members) owner.set(t.index, groups.length);
    groups.push({
      title: withoutDelimiters(sanitizeHalfWidthTitle(row.groupName), '/'),
      fullWidthTitle:
        row.groupFullWidthName === ''
          ? null
          : withoutDelimiters(sanitizeFullWidthTitle(row.groupFullWidthName), '／'),
      tracks: members,
    });
  }
  const ungrouped = renamed.filter((t) => !owner.has(t.index));

  const discRow = parsed.rows.find((row) => row.index === 0);
  const expected: Disc = {
    ...disc,
    title: discRow ? withoutDelimiters(sanitizeHalfWidthTitle(discRow.name), '/') : disc.title,
    fullWidthTitle: discRow
      ? withoutDelimiters(sanitizeFullWidthTitle(discRow.fullWidthName), '／')
      : disc.fullWidthTitle,
    groups: [
      ...(ungrouped.length > 0 ? [{ title: null, fullWidthTitle: null, tracks: ungrouped }] : []),
      ...groups,
    ],
  };
  commands.push({ kind: 'rewriteGroups', disc: expected });
  const balance = titleSpaceBalance(expected);
  return {
    commands,
    expected,
    fits: balance.halfWidth >= 0 && balance.fullWidth >= 0 && groupsFit(expected),
  };
}
