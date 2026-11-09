/*
 * Ported from netmd-js 4.4.1 (https://github.com/cybercase/netmd-js), by Stefano Brilli and
 * Asivery, GPL-2.0: `getDiscTitle` and `getTrackGroupList` (src/netmd-interface.ts),
 * `decodeFromSJIS` and `halfWidthToFullWidthRange` (src/utils.ts).
 *
 * Changes from upstream:
 * - Shift-JIS decodes with the platform's `TextDecoder` instead of `jconv`.
 * - Group parsing is a pure function over the raw titles instead of a method issuing queries.
 */

const sjis = new TextDecoder('shift_jis');

export function decodeSjis(bytes: Uint8Array): string {
  return sjis.decode(bytes);
}

const FULL_WIDTH: Readonly<Record<string, string>> = {
  '0': '０',
  '1': '１',
  '2': '２',
  '3': '３',
  '4': '４',
  '5': '５',
  '6': '６',
  '7': '７',
  '8': '８',
  '9': '９',
  '-': '－',
  '/': '／',
  ';': '；',
};

function toFullWidthRange(range: string): string {
  return range.replace(/./gu, (char) => FULL_WIDTH[char] ?? '');
}

/**
 * The title to show for a disc. A grouped disc stores `0;Title//1-3;Group//…` in its title field;
 * only the `0;` entry is the disc's own title.
 */
export function discDisplayTitle(raw: string, fullWidth: boolean): string {
  const delimiter = fullWidth ? '／／' : '//';
  const marker = fullWidth ? '０；' : '0;';
  if (!raw.endsWith(delimiter)) return raw;
  const first = raw.split(delimiter)[0] ?? '';
  return first.startsWith(marker) ? first.substring(marker.length) : '';
}

export interface TrackGroup {
  /** Null for the tracks that belong to no group. */
  readonly title: string | null;
  readonly fullWidthTitle: string | null;
  /** Zero-based track indexes. */
  readonly tracks: readonly number[];
}

/** Splits the disc's tracks into groups from the raw half- and full-width disc titles. */
export function parseGroups(
  rawTitle: string,
  rawFullWidthTitle: string,
  trackCount: number,
): TrackGroup[] {
  const owner = new Map<number, string>();
  const groups: TrackGroup[] = [];
  const fullWidthEntries = rawFullWidthTitle.split('／／');

  if (rawTitle.includes('//')) {
    for (const entry of rawTitle.split('//')) {
      if (entry === '' || entry.startsWith('0;') || !entry.includes(';')) continue;
      const range = entry.slice(0, entry.indexOf(';'));
      if (range === '') continue;
      const title = entry.substring(range.length + 1);
      const fullRange = toFullWidthRange(range);
      const fullWidthTitle =
        fullWidthEntries
          .find((name) => name.startsWith(fullRange))
          ?.substring(fullRange.length + 1) ?? null;

      const [minText, maxText] = range.includes('-') ? range.split('-') : [range, range];
      const min = Number.parseInt(minText ?? '', 10);
      // A deleted track can leave a group's range past the end of the disc.
      const max = Math.min(Number.parseInt(maxText ?? '', 10), trackCount);
      if (!(min >= 0 && min <= max)) throw new Error(`Invalid group range ${range}`);

      const tracks: number[] = [];
      for (let track = min - 1; track < max; track++) {
        const existing = owner.get(track);
        if (existing !== undefined)
          throw new Error(`Track ${String(track)} is in 2 groups: ${existing}`);
        owner.set(track, title);
        tracks.push(track);
      }
      groups.push({ title, fullWidthTitle, tracks });
    }
  }

  const ungrouped = [...Array(trackCount).keys()].filter((track) => !owner.has(track));
  if (ungrouped.length > 0)
    groups.unshift({ title: null, fullWidthTitle: null, tracks: ungrouped });
  return groups;
}
