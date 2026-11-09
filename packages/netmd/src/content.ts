/*
 * Ported from netmd-js 4.4.1, src/netmd-commands.ts (`listContent`, `Disc`, `Group`, `Track`)
 * and src/utils.ts (`timeToFrames`), https://github.com/cybercase/netmd-js,
 * by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream: the group list is parsed from the raw titles with `parseGroups`
 * instead of a separate interface method.
 */

import { DiscFlag, type DeviceTime, type NetMdInterface } from './interface';
import { discDisplayTitle, parseGroups } from './titles';

export const FRAMES_PER_SECOND = 512;
/** Some devices (Sharp) report capacity in the selected long-play mode; anything above this is halved. */
const MAX_SP_FRAMES = FRAMES_PER_SECOND * 60 * 82;

export interface Track {
  /** Zero-based position on the disc. */
  readonly index: number;
  readonly title: string;
  readonly fullWidthTitle: string;
  /** Length in frames (512 per second). */
  readonly duration: number;
  /** `Channels`: 0 stereo, 1 mono. */
  readonly channel: number;
  /** `Encoding`: SP, LP2 or LP4. */
  readonly encoding: number;
  readonly flags: number;
}

export interface Group {
  readonly title: string | null;
  readonly fullWidthTitle: string | null;
  readonly tracks: readonly Track[];
}

export interface Disc {
  readonly title: string;
  readonly fullWidthTitle: string;
  readonly writable: boolean;
  readonly writeProtected: boolean;
  /** Frames (512 per second), in SP terms. */
  readonly used: number;
  readonly left: number;
  readonly total: number;
  readonly trackCount: number;
  readonly groups: readonly Group[];
}

export function timeToFrames([hours, minutes, seconds, frames]: DeviceTime): number {
  return ((hours * 60 + minutes) * 60 + seconds) * FRAMES_PER_SECOND + frames;
}

/** Reads the whole table of contents of the disc in the device. */
export async function listContent(md: NetMdInterface): Promise<Disc> {
  const flags = await md.getDiscFlags();
  const rawTitle = await md.getRawDiscTitle();
  const rawFullWidthTitle = await md.getRawDiscTitle(true);
  const [usedTime, totalTime, leftTime] = await md.getDiscCapacity();
  const trackCount = await md.getTrackCount();

  let used = timeToFrames(usedTime);
  let total = timeToFrames(totalTime);
  let left = timeToFrames(leftTime);
  while (total > MAX_SP_FRAMES) {
    used /= 2;
    total /= 2;
    left /= 2;
  }

  const groups: Group[] = [];
  for (const group of parseGroups(rawTitle, rawFullWidthTitle, trackCount)) {
    const tracks: Track[] = [];
    for (const index of group.tracks) {
      const { codec, channel } = await md.getTrackEncoding(index);
      tracks.push({
        index,
        title: await md.getTrackTitle(index),
        fullWidthTitle: await md.getTrackTitle(index, true),
        duration: timeToFrames(await md.getTrackLength(index)),
        channel,
        encoding: codec,
        flags: await md.getTrackFlags(index),
      });
    }
    groups.push({ title: group.title, fullWidthTitle: group.fullWidthTitle, tracks });
  }

  return {
    title: discDisplayTitle(rawTitle, false),
    fullWidthTitle: discDisplayTitle(rawFullWidthTitle, true),
    writable: (flags & DiscFlag.writable) !== 0,
    writeProtected: (flags & DiscFlag.writeProtected) !== 0,
    used,
    left,
    total,
    trackCount,
    groups,
  };
}
