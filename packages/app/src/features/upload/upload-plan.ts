/*
 * The upload's fit check and title shortening, after webminidisc's convert dialog
 * (src/components/convert-dialog.tsx) and `convertAndUpload` (src/redux/actions.ts),
 * https://github.com/asivery/webminidisc, GPL-2.0.
 */

import { halfWidthTitleLength, type TitleSpace, type UploadMode } from '@mdconnect/netmd';

/** SP seconds of disc a second of audio uses in each mode (webminidisc: floor(292 / kbps)). */
const SP_SECONDS_PER_SECOND: Readonly<Record<UploadMode, number>> = {
  sp: 1,
  spMono: 0.5,
  lp2: 0.5,
  lp105: 0.5,
  lp4: 0.25,
};

/** The disc's free time is counted in SP seconds; this is what `seconds` of audio uses. */
export const discSecondsFor = (seconds: number, mode: UploadMode): number =>
  seconds * SP_SECONDS_PER_SECOND[mode];

export interface TimeFit {
  readonly neededSeconds: number;
  readonly freeSeconds: number;
  readonly fits: boolean;
}

/** Whether the tracks fit in the disc's free time, each in its own mode. */
export function timeFit(
  tracks: readonly { readonly durationSeconds: number; readonly mode: UploadMode }[],
  freeSeconds: number,
): TimeFit {
  const neededSeconds = tracks.reduce(
    (sum, track) => sum + discSecondsFor(track.durationSeconds, track.mode),
    0,
  );
  return { neededSeconds, freeSeconds, fits: neededSeconds <= freeSeconds };
}

export interface TrackTitles {
  /** Half-width, already converted for the disc. */
  readonly title: string;
  /** Full-width, already converted; empty for none. */
  readonly fullWidthTitle: string;
}

const CELL = 7;
const FULL_WIDTH_LIMIT = 105;

/** Space a stored title takes: whole 7-byte cells, at least one (webminidisc's `fixLength`). */
const stored = (bytes: number) => Math.max(Math.ceil(bytes / CELL) * CELL, CELL);

/** The longest start of `text` whose size, as measured, fits in `room`. */
function longestPrefix(text: string, room: number, size: (part: string) => number): string {
  const characters = Array.from(new Intl.Segmenter().segment(text), (part) => part.segment);
  let length = characters.length;
  while (length > 0 && size(characters.slice(0, length).join('')) > room) length--;
  return characters.slice(0, length).join('');
}

/**
 * Shortens titles, in order, to the disc's remaining title space, as webminidisc does during an
 * upload. Full-width titles are kept only when full-width titles are on, and at most 105
 * characters long.
 */
export function fitTitles(
  titles: readonly TrackTitles[],
  space: TitleSpace,
  fullWidth: boolean,
): { readonly titles: TrackTitles[]; readonly shortened: boolean } {
  let halfWidthLeft = space.halfWidth;
  let fullWidthLeft = space.fullWidth;
  let shortened = false;
  const fitted = titles.map(({ title, fullWidthTitle }) => {
    const half = longestPrefix(title, Math.max(halfWidthLeft, 0), halfWidthTitleLength);
    halfWidthLeft -= stored(halfWidthTitleLength(half));
    let full = '';
    if (fullWidth) {
      const room = Math.min(Math.max(fullWidthLeft, 0), FULL_WIDTH_LIMIT * 2);
      full = longestPrefix(fullWidthTitle, room, (part) => part.length * 2);
      fullWidthLeft -= stored(full.length * 2);
    }
    if (half !== title || (fullWidth && full !== fullWidthTitle)) shortened = true;
    return { title: half, fullWidthTitle: full };
  });
  return { titles: fitted, shortened };
}
