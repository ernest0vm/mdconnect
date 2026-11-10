import {
  groupsFit,
  sanitizeFullWidthTitle,
  sanitizeHalfWidthTitle,
  titleSpaceBalance,
  type Disc,
  type TitleSpace,
} from '@mdconnect/netmd';

import { groupTracksPlan, renameGroupPlan } from './edit-plan';

/** What a title dialog names: the disc, a track, a group being created, or an existing group. */
export type TitleTarget =
  | { readonly kind: 'disc' }
  | { readonly kind: 'track'; readonly index: number }
  | { readonly kind: 'new-group'; readonly tracks: readonly number[] }
  /** The group that contains `track`. */
  | { readonly kind: 'group'; readonly track: number };

export interface TitleInput {
  readonly halfWidth: string;
  readonly fullWidth: string;
}

export interface TitleForm {
  /** The titles as they will be stored. */
  readonly halfWidth: string;
  readonly fullWidth: string;
  readonly halfWidthChanged: boolean;
  readonly fullWidthChanged: boolean;
  /** Space left on the disc once these titles are saved. */
  readonly remaining: TitleSpace;
  readonly fits: boolean;
  /** A group needs a half-width title; an untitled group could not be renamed or ungrouped. */
  readonly missingTitle: boolean;
}

/**
 * Disc and group titles share the disc title field, where `//` (`／／` in full width) ends each
 * entry. A doubled or trailing slash in a title would split it, so it collapses to one or goes.
 */
function withoutDelimiters(title: string, slash: '/' | '／'): string {
  return title
    .replace(slash === '/' ? /\/{2,}/gu : /／{2,}/gu, slash)
    .replace(slash === '/' ? /\/+$/u : /／+$/u, '');
}

const STORED_IN_DISC_TITLE: ReadonlySet<TitleTarget['kind']> = new Set([
  'disc',
  'new-group',
  'group',
]);
const NEEDS_TITLE: ReadonlySet<TitleTarget['kind']> = new Set(['new-group', 'group']);

/** The titles the target has now. */
export function currentTitles(disc: Disc, target: TitleTarget): TitleInput {
  switch (target.kind) {
    case 'disc':
      return { halfWidth: disc.title, fullWidth: disc.fullWidthTitle };
    case 'track': {
      const track = disc.groups.flatMap((g) => g.tracks).find((t) => t.index === target.index);
      return { halfWidth: track?.title ?? '', fullWidth: track?.fullWidthTitle ?? '' };
    }
    case 'new-group':
      return { halfWidth: '', fullWidth: '' };
    case 'group': {
      const group = disc.groups.find((g) => g.tracks.some((t) => t.index === target.track));
      return { halfWidth: group?.title ?? '', fullWidth: group?.fullWidthTitle ?? '' };
    }
  }
}

/** The disc as it would be with the new titles, to measure the title space. */
function withTitles(disc: Disc, target: TitleTarget, titles: TitleInput): Disc {
  switch (target.kind) {
    case 'disc':
      return { ...disc, title: titles.halfWidth, fullWidthTitle: titles.fullWidth };
    case 'track':
      return {
        ...disc,
        groups: disc.groups.map((group) => ({
          ...group,
          tracks: group.tracks.map((track) =>
            track.index === target.index
              ? { ...track, title: titles.halfWidth, fullWidthTitle: titles.fullWidth }
              : track,
          ),
        })),
      };
    case 'new-group': {
      const plan = groupTracksPlan(disc, target.tracks, titles.halfWidth, titles.fullWidth);
      return plan.kind === 'plan' ? plan.expected : disc;
    }
    case 'group':
      return renameGroupPlan(disc, target.track, titles.halfWidth, titles.fullWidth).expected;
  }
}

/** Converts what the user typed, and checks that it fits in the disc's title space. */
export function titleForm(disc: Disc, target: TitleTarget, input: TitleInput): TitleForm {
  const inDiscTitle = STORED_IN_DISC_TITLE.has(target.kind);
  const halfWidth = inDiscTitle
    ? withoutDelimiters(sanitizeHalfWidthTitle(input.halfWidth), '/')
    : sanitizeHalfWidthTitle(input.halfWidth);
  const fullWidth = inDiscTitle
    ? withoutDelimiters(sanitizeFullWidthTitle(input.fullWidth), '／')
    : sanitizeFullWidthTitle(input.fullWidth);
  const current = currentTitles(disc, target);
  const changedDisc = withTitles(disc, target, { halfWidth, fullWidth });
  const balance = titleSpaceBalance(changedDisc);
  return {
    halfWidth,
    fullWidth,
    halfWidthChanged: halfWidth !== current.halfWidth,
    fullWidthChanged: fullWidth !== current.fullWidth,
    remaining: {
      halfWidth: Math.max(balance.halfWidth, 0),
      fullWidth: Math.max(balance.fullWidth, 0),
    },
    // The balance is an estimate; the compiled disc title field is what decides.
    fits: balance.halfWidth >= 0 && balance.fullWidth >= 0 && groupsFit(changedDisc),
    missingTitle: NEEDS_TITLE.has(target.kind) && halfWidth.trim() === '',
  };
}
