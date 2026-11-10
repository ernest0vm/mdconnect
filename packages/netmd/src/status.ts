/*
 * Ported from netmd-js 4.4.1, src/netmd-commands.ts (`getDeviceStatus`, `OperatingStatus`,
 * `DeviceStatus`), https://github.com/cybercase/netmd-js, by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream: the operating status table is a typed record; a code not in it is
 * `unknown`, as upstream reports it.
 */

import type { NetMdInterface } from './interface';

const OPERATING_STATUS = {
  50687: 'ready',
  50037: 'playing',
  50045: 'paused',
  49983: 'fastForward',
  49999: 'rewind',
  65315: 'readingTOC',
  65296: 'noDisc',
  65535: 'discBlank',
  65319: 'readyForTransfer',
} as const satisfies Readonly<Record<number, string>>;

export type OperatingState = (typeof OPERATING_STATUS)[keyof typeof OPERATING_STATUS] | 'unknown';

export interface DeviceStatus {
  /** False with no disc, and while the device reads the disc's table of contents. */
  readonly discPresent: boolean;
  readonly state: OperatingState;
  /** Zero-based track under the head, or null when the device does not say. */
  readonly track: number | null;
  /** Elapsed time in the track, with hours counted into minutes. */
  readonly time: {
    readonly minute: number;
    readonly second: number;
    readonly frame: number;
  } | null;
}

const DISC_ABSENT = 0x80;

/** The named state for an operating status code, or `unknown`. */
function operatingState(code: number): OperatingState {
  return code in OPERATING_STATUS
    ? OPERATING_STATUS[code as keyof typeof OPERATING_STATUS]
    : 'unknown';
}

/** What the device is doing: its state, the track under the head and the time in it. */
export async function getDeviceStatus(md: NetMdInterface): Promise<DeviceStatus> {
  const status = await md.getStatus();
  const playback = await md.getPlaybackStatus2();
  const position = await md.getPosition();

  const discInserted = status[4] !== DISC_ABSENT;
  let state = operatingState(((playback[4] ?? 0) << 8) | (playback[5] ?? 0));
  if (state === 'playing' && !discInserted) state = 'ready';

  return {
    discPresent: discInserted && state !== 'readingTOC' && state !== 'noDisc',
    state,
    track: position ? position[0] : null,
    time: position
      ? { minute: position[2] + position[1] * 60, second: position[3], frame: position[4] }
      : null,
  };
}
