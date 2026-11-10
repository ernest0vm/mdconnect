/*
 * Ported from netmd-js 4.4.1, src/netmd-commands.ts (`renameDisc`, `rewriteDiscGroups`),
 * https://github.com/cybercase/netmd-js, by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - Titles are not sanitised here; callers pass converted titles (see sanitize.ts).
 * - Whether the full-width title has groups is checked on the full-width title; upstream checked
 *   the half-width one.
 * - Clearing the title of a disc that only has groups leaves its groups as they are; upstream
 *   added an empty `0;//` entry.
 * - The title replacement is a pure function, `replaceDiscTitle`.
 * - A title field holds groups only when it ends with the delimiter (as `getDiscTitle` decides);
 *   upstream treated any `//` as groups, so renaming "AC//DC" left "0;New//AC//DC".
 */

import type { Disc } from './content';
import { compileDiscTitles } from './disc-titles';
import type { NetMdInterface } from './interface';
import { discDisplayTitle } from './titles';

/** The part of the NetMD interface that reads and writes the raw disc title. */
export type DiscTitleWriter = Pick<NetMdInterface, 'getRawDiscTitle' | 'setDiscTitle'>;

/** Replaces the disc's own title in a raw title field, keeping its group entries. */
export function replaceDiscTitle(raw: string, title: string, fullWidth: boolean): string {
  const delimiter = fullWidth ? '／／' : '//';
  const marker = fullWidth ? '０；' : '0;';
  // Like `discDisplayTitle`: a title field holds groups only when it ends with the delimiter, so a
  // plain title such as "AC//DC" is replaced whole.
  if (!raw.endsWith(delimiter)) return title;
  const entry = title === '' ? '' : `${marker}${title}${delimiter}`;
  if (raw.startsWith(marker)) {
    return entry + raw.slice(raw.indexOf(delimiter) + delimiter.length);
  }
  return entry + raw;
}

/** Renames the disc, keeping its groups. The full-width title is left alone when not given. */
export async function renameDisc(
  md: DiscTitleWriter,
  title: string,
  fullWidthTitle?: string,
): Promise<void> {
  if (fullWidthTitle !== undefined) {
    const raw = await md.getRawDiscTitle(true);
    if (discDisplayTitle(raw, true) !== fullWidthTitle) {
      await md.setDiscTitle(replaceDiscTitle(raw, fullWidthTitle, true), true);
    }
  }
  const raw = await md.getRawDiscTitle();
  if (discDisplayTitle(raw, false) !== title) {
    await md.setDiscTitle(replaceDiscTitle(raw, title, false));
  }
}

/** Writes the disc title fields so they store `disc`'s title and groups. */
export async function rewriteDiscGroups(md: DiscTitleWriter, disc: Disc): Promise<void> {
  const { title, fullWidthTitle } = compileDiscTitles(disc);
  await md.setDiscTitle(title);
  await md.setDiscTitle(fullWidthTitle, true);
}
