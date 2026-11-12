import type { Song } from '@mdconnect/core';

import { TITLE_PARTS, TITLE_SEPARATOR, type TagTitleSource } from '../upload/title-source';

/** How a new title is built from the song found: the upload dialog's five tag formats. */
export type TitleFormat = TagTitleSource;

export const TITLE_FORMATS: readonly TitleFormat[] = [
  'title',
  'artist-title',
  'title-artist',
  'album-title',
  'artist-album-title',
];

/** The title in the chosen format; a part the service did not return is left out. */
export function formatTitle(song: Song, format: TitleFormat): string {
  return TITLE_PARTS[format]
    .map((part) => song[part]?.trim() ?? '')
    .filter((value) => value !== '')
    .join(TITLE_SEPARATOR);
}
