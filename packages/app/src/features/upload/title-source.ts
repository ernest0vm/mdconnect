import type { AudioTags } from './tags';

/** Where a new track's title comes from (webminidisc's "Track title" option). */
export type TitleSource =
  'file' | 'title' | 'album-title' | 'artist-title' | 'title-artist' | 'artist-album-title';

type TagName = 'title' | 'artist' | 'album';

const PARTS: Readonly<Record<Exclude<TitleSource, 'file'>, readonly TagName[]>> = {
  title: ['title'],
  'album-title': ['album', 'title'],
  'artist-title': ['artist', 'title'],
  'title-artist': ['title', 'artist'],
  'artist-album-title': ['artist', 'album', 'title'],
};

const SEPARATOR = ' - ';

/** The file name without its extension; a leading dot is part of the name. */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * A track title from the chosen source. When the tags lack a field the source needs, the title is
 * the file name without its extension.
 */
export function titleFromSource(source: TitleSource, tags: AudioTags, fileName: string): string {
  if (source === 'file') return baseName(fileName);
  const values = PARTS[source].map((name) => tags[name]?.trim() ?? '');
  return values.every((value) => value !== '') ? values.join(SEPARATOR) : baseName(fileName);
}
