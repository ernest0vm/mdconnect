/*
 * Ported from netmd-js 4.4.1, src/netmd-commands.ts (`getCellsForTitle`,
 * `getRemainingCharactersForTitles`, `compileDiscTitles`), https://github.com/cybercase/netmd-js,
 * by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - A one-track group's range is counted as `n`; upstream appended the text `false`, counting
 *   5 characters too many.
 * - A group without a full-width title counts as empty; upstream counted the text `null`.
 * - The final full-width length check is in characters, like the half-width one (upstream
 *   compared cells with characters).
 */

import type { Disc, Track } from './content';
import { Encoding } from './interface';
import { halfWidthTitleLength } from './sanitize';
import { discDisplayTitle, parseGroups, toFullWidthRange } from './titles';

/** The disc's title area: 255 cells of 7 bytes (see https://www.minidisc.org/md_toc.html). */
const CELL_LIMIT = 255;
const CELL_BYTES = 7;

const SP: number = Encoding.sp;

const cells = (bytes: number) => Math.ceil(bytes / CELL_BYTES);

/** Title cells one track uses, half-width and full-width. */
function cellsForTrack(track: Track): { halfWidth: number; fullWidth: number } {
  // Devices may prefix long-play track titles with "LP: ", even untitled ones.
  const longPlay = track.encoding === SP ? 0 : 1;
  return {
    halfWidth: Math.max(longPlay, cells(halfWidthTitleLength(track.title))),
    fullWidth: Math.max(longPlay, cells(track.fullWidthTitle.length * 2)),
  };
}

/** The 1-based range of a group as stored: `3` or `3-5`. */
function groupRange(indexes: readonly number[]): string {
  const first = Math.min(...indexes) + 1;
  return indexes.length === 1
    ? String(first)
    : `${String(first)}-${String(first + indexes.length - 1)}`;
}

export interface TitleSpace {
  /** Characters still available for half-width titles. */
  readonly halfWidth: number;
  /** Bytes still available for full-width titles (two per character). */
  readonly fullWidth: number;
}

/** How much title space is left on the disc, assuming the disc title and groups are rewritten. */
export function remainingTitleSpace(disc: Disc, includeGroups = true): TitleSpace {
  const balance = titleSpaceBalance(disc, includeGroups);
  return { halfWidth: Math.max(balance.halfWidth, 0), fullWidth: Math.max(balance.fullWidth, 0) };
}

/** Like `remainingTitleSpace`, but negative when the titles overflow the disc's title area. */
export function titleSpaceBalance(disc: Disc, includeGroups = true): TitleSpace {
  let halfWidthTitle = `${disc.title}0;//`;
  let fullWidthTitle = `${disc.fullWidthTitle}0;//`;
  if (includeGroups) {
    for (const group of disc.groups) {
      if (group.title === null || group.tracks.length === 0) continue;
      const range = `${groupRange(group.tracks.map((t) => t.index))}//`;
      halfWidthTitle += group.title + range;
      fullWidthTitle += (group.fullWidthTitle ?? '') + range;
    }
  }

  let halfWidthCells = cells(halfWidthTitleLength(halfWidthTitle));
  let fullWidthCells = cells(fullWidthTitle.length * 2);
  for (const track of disc.groups.flatMap((g) => g.tracks)) {
    const used = cellsForTrack(track);
    halfWidthCells += used.halfWidth;
    fullWidthCells += used.fullWidth;
  }
  return {
    halfWidth: (CELL_LIMIT - halfWidthCells) * CELL_BYTES,
    fullWidth: (CELL_LIMIT - fullWidthCells) * CELL_BYTES,
  };
}

/**
 * Title space left once `changed`'s track titles are stored next to the disc title field as
 * `stored` writes it (groups with their ";" and range included). Use it for edits that do not
 * rewrite the disc title field, such as a track rename, where the estimate in
 * `titleSpaceBalance` leaves out the separators of the stored group entries.
 */
export function titleSpaceWithStoredTitle(stored: Disc, changed: Disc): TitleSpace {
  const field = storedDiscTitles(stored);
  let halfWidthCells = cells(halfWidthTitleLength(field.title));
  let fullWidthCells = cells(field.fullWidthTitle.length * 2);
  for (const track of changed.groups.flatMap((g) => g.tracks)) {
    const used = cellsForTrack(track);
    halfWidthCells += used.halfWidth;
    fullWidthCells += used.fullWidth;
  }
  return {
    halfWidth: (CELL_LIMIT - halfWidthCells) * CELL_BYTES,
    fullWidth: (CELL_LIMIT - fullWidthCells) * CELL_BYTES,
  };
}

/**
 * The disc title fields as a disc with these titles and groups stores them, with every entry.
 * Unlike `compileDiscTitles`, nothing is left out for lack of space: this measures what is there.
 */
function storedDiscTitles(disc: Disc): RawDiscTitles {
  const groups = disc.groups.filter((g) => g.title !== null && g.tracks.length > 0);
  if (groups.length === 0) return { title: disc.title, fullWidthTitle: disc.fullWidthTitle };
  const ranges = groups.map((g) => groupRange(g.tracks.map((t) => t.index)));
  const title =
    (disc.title === '' ? '' : `0;${disc.title}//`) +
    groups.map((g, i) => `${ranges[i] ?? ''};${g.title ?? ''}//`).join('');
  const useFullWidth =
    disc.fullWidthTitle !== '' ||
    groups.some((g) => (g.fullWidthTitle ?? '') !== '') ||
    disc.groups.some((g) => g.tracks.some((t) => t.fullWidthTitle !== ''));
  const fullWidthTitle = useFullWidth
    ? `０；${disc.fullWidthTitle}／／` +
      groups
        .map((g, i) => `${toFullWidthRange(ranges[i] ?? '')}；${g.fullWidthTitle ?? ''}／／`)
        .join('')
    : '';
  return { title, fullWidthTitle };
}

export interface RawDiscTitles {
  readonly title: string;
  readonly fullWidthTitle: string;
}

/**
 * The raw disc titles that store the disc title and its groups (`0;Disc//1-3;Group//`).
 * Groups that do not fit in the remaining title space are left out.
 */
export function compileDiscTitles(disc: Disc): RawDiscTitles {
  const available = remainingTitleSpace({ ...disc, title: '', fullWidthTitle: '' }, false);
  const useFullWidth =
    disc.fullWidthTitle !== '' ||
    disc.groups.some((g) => (g.fullWidthTitle ?? '') !== '') ||
    disc.groups.some((g) => g.tracks.some((t) => t.fullWidthTitle !== ''));

  let title = disc.title === '' ? '' : `0;${disc.title}//`;
  let fullWidthTitle = useFullWidth ? `０；${disc.fullWidthTitle}／／` : '';
  let groupCount = 0;

  for (const group of disc.groups) {
    if (group.title === null || group.tracks.length === 0) continue;
    groupCount++;
    const range = groupRange(group.tracks.map((t) => t.index));

    const withGroup = `${title}${range};${group.title}//`;
    if (cells(halfWidthTitleLength(withGroup)) * CELL_BYTES <= available.halfWidth)
      title = withGroup;

    if (useFullWidth) {
      const fullWithGroup = `${fullWidthTitle}${toFullWidthRange(range)}；${group.fullWidthTitle ?? ''}／／`;
      if (cells(fullWithGroup.length * 2) * CELL_BYTES <= available.fullWidth) {
        fullWidthTitle = fullWithGroup;
      }
    }
  }

  if (groupCount === 0) {
    title = disc.title;
    fullWidthTitle = disc.fullWidthTitle;
  }
  // If even the titles without groups do not fit, leave them empty rather than overflow.
  if (cells(halfWidthTitleLength(title)) * CELL_BYTES > available.halfWidth) title = '';
  if (cells(fullWidthTitle.length * 2) * CELL_BYTES > available.fullWidth) fullWidthTitle = '';

  return { title, fullWidthTitle: useFullWidth ? fullWidthTitle : '' };
}

/**
 * Whether writing `disc` keeps all of it: every titled group and the disc title survive
 * `compileDiscTitles`, which leaves out what does not fit. Use it before any change to the
 * groups or the track order, since group ranges change length too.
 */
export function groupsFit(disc: Disc): boolean {
  const compiled = compileDiscTitles(disc);
  const groups = disc.groups.filter((g) => g.title !== null && g.tracks.length > 0);
  const kept = parseGroups(compiled.title, compiled.fullWidthTitle, disc.trackCount).filter(
    (g) => g.title !== null,
  );
  if (kept.length !== groups.length) return false;
  // Each group must come back with the same tracks and titles. Full-width titles are stored in
  // their own field, which can run out on its own.
  const allKept = groups.every((group) => {
    const tracks = group.tracks.map((t) => t.index).sort((a, b) => a - b);
    const match = kept.find((g) => g.tracks.join() === tracks.join());
    if (match?.title !== group.title) return false;
    return (group.fullWidthTitle ?? '') === '' || match.fullWidthTitle === group.fullWidthTitle;
  });
  if (!allKept) return false;
  if (discDisplayTitle(compiled.title, false) !== disc.title) return false;
  return (
    disc.fullWidthTitle === '' ||
    discDisplayTitle(compiled.fullWidthTitle, true) === disc.fullWidthTitle
  );
}
