import { Channels, Encoding, FRAMES_PER_SECOND, type Disc, type Track } from '@mdconnect/netmd';

export interface TrackView {
  /** 1-based position on the disc, as on the device's display. */
  readonly number: number;
  readonly title: string;
  readonly untitled: boolean;
  readonly duration: string;
  readonly mode: string;
}

export interface GroupView {
  /** Null for tracks outside any group. */
  readonly title: string | null;
  readonly tracks: readonly TrackView[];
}

export interface DiscView {
  /** Null when the disc has no title. */
  readonly title: string | null;
  readonly writeProtected: boolean;
  readonly capacity: { readonly used: string; readonly free: string; readonly total: string };
  readonly groups: readonly GroupView[];
}

/** Minutes and seconds (`m:ss`), with minutes past 59 kept as minutes, like the device shows. */
export function formatDuration(frames: number): string {
  const totalSeconds = Math.floor(frames / FRAMES_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

const MODE_LABELS: Readonly<Record<number, string>> = {
  [Encoding.sp]: 'SP',
  [Encoding.lp2]: 'LP2',
  [Encoding.lp4]: 'LP4',
};

const MONO: number = Channels.mono;

function modeLabel(track: Track): string {
  const base = MODE_LABELS[track.encoding] ?? 'Unknown mode';
  return track.channel === MONO ? `${base} mono` : base;
}

/** Half-width title first; a disc written with only full-width (Japanese) titles uses those. */
const pickTitle = (halfWidth: string, fullWidth: string | null): string =>
  halfWidth !== '' ? halfWidth : (fullWidth ?? '');

function trackView(track: Track): TrackView {
  const title = pickTitle(track.title, track.fullWidthTitle);
  return {
    number: track.index + 1,
    title: title === '' ? 'Untitled' : title,
    untitled: title === '',
    duration: formatDuration(track.duration),
    mode: modeLabel(track),
  };
}

/**
 * What the Disc screen shows. Groups are listed in disc order: consecutive tracks that share a
 * group form one section, so tracks outside any group appear where they are on the disc.
 */
export function toDiscView(disc: Disc): DiscView {
  const owned = disc.groups.flatMap((group) =>
    group.tracks.map((track) => ({
      group: pickTitle(group.title ?? '', group.fullWidthTitle) || null,
      track,
    })),
  );
  owned.sort((a, b) => a.track.index - b.track.index);

  const groups: { title: string | null; tracks: TrackView[] }[] = [];
  for (const { group, track } of owned) {
    const last = groups.at(-1);
    if (last?.title === group) {
      last.tracks.push(trackView(track));
    } else {
      groups.push({ title: group, tracks: [trackView(track)] });
    }
  }

  const title = pickTitle(disc.title, disc.fullWidthTitle);
  return {
    title: title === '' ? null : title,
    writeProtected: disc.writeProtected,
    capacity: {
      // Devices report used time as playback time, which exceeds the SP total on long-play discs.
      used: formatDuration(Math.max(0, disc.total - disc.left)),
      free: formatDuration(disc.left),
      total: formatDuration(disc.total),
    },
    groups,
  };
}
