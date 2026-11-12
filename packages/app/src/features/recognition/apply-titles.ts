import {
  sanitizeFullWidthTitle,
  sanitizeHalfWidthTitle,
  titleSpaceWithStoredTitle,
  type Disc,
} from '@mdconnect/netmd';

import type { EditCommand, EditPlan } from '../disc/edit-plan';

/** A new title for a track, as typed or formatted, before conversion. */
export interface NewTitle {
  /** Zero-based track index. */
  readonly index: number;
  readonly raw: string;
}

/** A new title as the disc will store it. */
export interface StoredTitle {
  readonly index: number;
  readonly halfWidth: string;
  /** Empty when the track gets no full-width title. */
  readonly fullWidth: string;
}

export interface NewTitlesReview {
  readonly titles: readonly StoredTitle[];
  /** Only title commands: groups and the other titles are left as they are. */
  readonly plan: EditPlan;
  readonly fits: boolean;
  /** Why the titles cannot be applied, or null. */
  readonly blocker: string | null;
}

/**
 * Whether a character needs a full-width title: the full-width title stores it as it is, and the
 * half-width title changes it into something that does not turn back into it (kanji, hiragana,
 * symbols such as "♪"). Full-width letters, the full-width space and katakana come back from their
 * half-width forms, so they do not.
 */
const needsFullWidth = (char: string): boolean => {
  const half = sanitizeHalfWidthTitle(char);
  return (
    sanitizeFullWidthTitle(char) === char && half !== char && sanitizeFullWidthTitle(half) !== char
  );
};

/**
 * The full-width title for a new title: its full-width conversion, the same as when renaming,
 * when full-width titles are on and the title has a character only a full-width title can hold;
 * otherwise empty, which clears a track's old full-width title.
 */
export function fullWidthTitleFor(raw: string, fullWidthTitles: boolean): string {
  if (!fullWidthTitles) return '';
  // Iterating a string goes by code point, so an emoji is one character.
  for (const char of raw) {
    if (needsFullWidth(char)) return sanitizeFullWidthTitle(raw);
  }
  return '';
}

/** Converts the new titles, checks that they fit, and builds the plan that writes only them. */
export function reviewNewTitles(
  disc: Disc,
  newTitles: readonly NewTitle[],
  { fullWidth }: { readonly fullWidth: boolean },
): NewTitlesReview {
  const titles = newTitles.map(({ index, raw }) => ({
    index,
    halfWidth: sanitizeHalfWidthTitle(raw),
    fullWidth: fullWidthTitleFor(raw, fullWidth),
  }));
  const byIndex = new Map(titles.map((title) => [title.index, title]));
  const commands: EditCommand[] = [];
  const changed: Disc = {
    ...disc,
    groups: disc.groups.map((group) => ({
      ...group,
      tracks: group.tracks.map((track) => {
        const title = byIndex.get(track.index);
        return title === undefined
          ? track
          : { ...track, title: title.halfWidth, fullWidthTitle: title.fullWidth };
      }),
    })),
  };
  const current = new Map(disc.groups.flatMap((group) => group.tracks).map((t) => [t.index, t]));
  for (const title of [...titles].sort((a, b) => a.index - b.index)) {
    const track = current.get(title.index);
    if (track === undefined) continue;
    if (title.halfWidth !== track.title) {
      commands.push({
        kind: 'setTrackTitle',
        track: title.index,
        title: title.halfWidth,
        fullWidth: false,
      });
    }
    if (title.fullWidth !== track.fullWidthTitle) {
      commands.push({
        kind: 'setTrackTitle',
        track: title.index,
        title: title.fullWidth,
        fullWidth: true,
      });
    }
  }
  const balance = titleSpaceWithStoredTitle(disc, changed);
  const fits = balance.halfWidth >= 0 && balance.fullWidth >= 0;
  return { titles, plan: { commands }, fits, blocker: blockerFor(disc, titles, commands, fits) };
}

function blockerFor(
  disc: Disc,
  titles: readonly StoredTitle[],
  commands: readonly EditCommand[],
  fits: boolean,
): string | null {
  if (disc.writeProtected) return 'The disc is write-protected. Slide its tab to edit it.';
  if (titles.length === 0) return 'Tick a track that has a new title.';
  // A title of characters the disc cannot store would blank the track's title.
  const blank = titles.find((title) => title.halfWidth.trim() === '' && title.fullWidth === '');
  if (blank !== undefined) {
    return `Track ${String(blank.index + 1)}’s new title has no character the disc can store.`;
  }
  if (commands.length === 0) return 'The disc already has these titles.';
  if (!fits) return 'The new titles do not fit in the disc’s title space.';
  return null;
}
