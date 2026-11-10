import { sourceRepositoryUrl } from '@mdconnect/core';

/** For each More menu item, why it is unavailable, or null when it can be used. */
export interface MenuAvailability {
  readonly export: string | null;
  readonly import: string | null;
  readonly wipe: string | null;
  readonly about: string | null;
  readonly exit: string | null;
}

/** Which menu items are available. About and Exit always are; Exit waits for work in progress. */
export function menuAvailability(state: {
  discRead: boolean;
  writeProtected: boolean;
  busy: boolean;
}): MenuAvailability {
  const noDisc = state.discRead ? null : 'No disc has been read.';
  const writing =
    noDisc ??
    (state.busy
      ? 'Wait for the current change to finish.'
      : state.writeProtected
        ? 'The disc is write-protected.'
        : null);
  return { export: noDisc, import: writing, wipe: writing, about: null, exit: null };
}

export interface MenuLink {
  readonly label: string;
  readonly href: string;
}

/** The More menu's links, which open in the default browser. */
export const MENU_LINKS: readonly MenuLink[] = [
  { label: 'Support and FAQ', href: 'https://www.minidisc.wiki/guides/start' },
  { label: 'Source code on GitHub', href: sourceRepositoryUrl },
  { label: 'Donate', href: 'https://paypal.me/ernest0vm' },
];

/** The import review's note on rows of the file past the end of the disc, or '' for none. */
export function ignoredTracksNote(outside: readonly number[]): string {
  if (outside.length === 0) return '';
  const names = outside.map(String);
  const last = names.pop();
  const list = names.length === 0 ? last : `${names.join(', ')} and ${String(last)}`;
  return `${outside.length === 1 ? 'Track' : 'Tracks'} ${String(list)} of the file will be ignored.`;
}
