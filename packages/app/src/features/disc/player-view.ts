import type { DeviceStatus, OperatingState } from '@mdconnect/netmd';

import type { DiscReadResult } from './disc-reader';

const STATE_LABELS: Readonly<Record<OperatingState, string>> = {
  ready: 'Stopped',
  playing: 'Playing',
  paused: 'Paused',
  fastForward: 'Fast-forward',
  rewind: 'Rewind',
  readingTOC: 'Reading disc',
  noDisc: 'No disc',
  discBlank: 'Blank disc',
  readyForTransfer: 'Ready for transfer',
  unknown: 'Unknown state',
};

export interface PlayerView {
  /** Three-digit track number, as on the device's display, or null. */
  readonly track: string | null;
  readonly title: string | null;
  readonly time: string | null;
  readonly state: string;
  /** What assistive technology hears: the track and state, never the running time. */
  readonly announcement: string;
  /** Whether Play/Pause should offer Pause. */
  readonly playing: boolean;
}

/** What the player shows for a status, given the titles of the disc's tracks in order. */
export function playerView(status: DeviceStatus | null, titles: readonly string[]): PlayerView {
  if (status === null) {
    return {
      track: null,
      title: null,
      time: null,
      state: 'No status from the device',
      announcement: '',
      playing: false,
    };
  }
  const state = STATE_LABELS[status.state];
  if (status.track === null || !status.discPresent) {
    return { track: null, title: null, time: null, state, announcement: state, playing: false };
  }
  const number = status.track + 1;
  const stored = titles[status.track] ?? '';
  const title = stored === '' ? 'Untitled' : stored;
  const time = status.time
    ? `${String(status.time.minute)}:${String(status.time.second).padStart(2, '0')}`
    : null;
  return {
    track: String(number).padStart(3, '0'),
    title,
    time,
    state,
    announcement: `${state} track ${String(number)}, ${title}`,
    playing: status.state === 'playing',
  };
}

/** Why the player controls are unavailable, or null. */
export function playerBlocker(state: {
  status: DeviceStatus | null;
  reading: boolean;
  saving: boolean;
  /** False when the last read failed: in use, in Hi-MD mode, or not answering. */
  readable: boolean;
  /** True when the last read found no disc; a later status showing a disc overrides it. */
  noDisc?: boolean;
}): string | null {
  if (state.reading) return 'Wait until the disc is read.';
  if (!state.readable) return 'The device cannot be read, so it cannot play.';
  if (state.saving) return 'Wait for the current change to finish.';
  const discSeen = state.status?.discPresent;
  if (discSeen === false || (state.noDisc === true && discSeen !== true)) {
    return 'Insert a disc to play it.';
  }
  return null;
}

/** Whether a track is the one playing, the one paused, or neither. */
export function trackPlayState(
  status: DeviceStatus | null,
  track: number,
): 'playing' | 'paused' | 'none' {
  if (status?.track !== track) return 'none';
  if (status.state === 'playing') return 'playing';
  if (status.state === 'paused') return 'paused';
  return 'none';
}

/** A readable message for a control the device did not take. */
export function controlFailureMessage(reason: 'rejected' | 'failed'): string {
  return reason === 'rejected'
    ? 'The device did not accept the command.'
    : 'The device stopped answering. Check the cable, then try again.';
}

/**
 * The device status to keep once a disc read finishes. A read that found no disc, or that failed,
 * makes an earlier status stale (the disc may have been swapped), so it is dropped until the next
 * poll; a successful read keeps it.
 */
export function statusAfterRead(
  previous: DeviceStatus | null,
  read: Pick<DiscReadResult, 'kind'>,
): DeviceStatus | null {
  return read.kind === 'disc' ? previous : null;
}
