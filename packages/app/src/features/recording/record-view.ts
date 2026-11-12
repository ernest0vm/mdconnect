import type { RecordingEnding, RecordingSummary } from './session';

/** The reason every other control gives while a recording runs. */
export const RECORDING_IN_PROGRESS = 'Wait for the recording to finish.';

/**
 * Why Record is unavailable, or null. Recording only reads the disc, so a write-protected disc
 * does not block it.
 */
export function recordBlocker(state: {
  readonly selected: number;
  readonly busy: boolean;
  readonly playBlocker: string | null;
  readonly recording: boolean;
}): string | null {
  if (state.recording) return RECORDING_IN_PROGRESS;
  if (state.busy) return 'Wait for the current change or upload to finish.';
  if (state.playBlocker !== null) return state.playBlocker;
  if (state.selected === 0) return 'Select tracks to record them.';
  return null;
}

/** An audio input as the setup dialog lists it. */
export interface AudioInput {
  readonly deviceId: string;
  readonly label: string;
}

/** Chromium's id for the input the operating system uses by default. */
const SYSTEM_DEFAULT_INPUT = 'default';

/**
 * The input to start with: the remembered one if it is still there, else the system's default
 * input (not whatever the browser happens to list first, such as a phone's microphone), else the
 * first.
 */
export function chooseInput(
  inputs: readonly AudioInput[],
  remembered: string | null,
): string | null {
  const present = (id: string | null) => inputs.find((input) => input.deviceId === id)?.deviceId;
  return present(remembered) ?? present(SYSTEM_DEFAULT_INPUT) ?? inputs[0]?.deviceId ?? null;
}

/** Why the chosen input cannot be used, from the error opening it. */
export function inputProblem(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'mdconnect cannot hear the input because audio capture was refused. Allow microphone access for mdconnect: on macOS in System Settings → Privacy & Security → Microphone, on Windows in Settings → Privacy → Microphone (with “Let desktop apps access your microphone” on), or in the browser through the site settings.';
  }
  if (name === 'InputLostError') {
    return 'The input stopped. Check that it is still connected, then choose it again.';
  }
  if (name === 'InputProcessingError') {
    return 'This input keeps cleaning up the sound (echo cancellation, noise suppression or automatic gain), which would change the music. Choose a line-in or a USB audio interface instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'This computer has no audio input. Connect the deck to a line-in or microphone input, or through a USB audio interface.';
  }
  return 'The input could not be opened. Close other apps that may be using it, then try again.';
}

/** Shown when the folder for the recordings could not be opened. */
export const FOLDER_PROBLEM =
  'The folder for the recordings could not be opened. Try again, or choose another folder.';

/** The progress dialog's line for the track being recorded. */
export function progressLabel(progress: {
  readonly position: number;
  readonly total: number;
  readonly title: string;
}): string {
  return `Track ${String(progress.position + 1)} of ${String(progress.total)}: “${progress.title}”`;
}

const files = (count: number) => `${String(count)} ${count === 1 ? 'file' : 'files'}`;

/** What the summary says: how many files were saved and where, how it ended, and any clipping. */
export function summaryLines(summary: RecordingSummary): string[] {
  const where =
    summary.folder === null
      ? `${files(summary.saved.length)} sent to the browser’s downloads`
      : `${files(summary.saved.length)} saved to “${summary.folder}”`;
  const lines = [endingLine(summary.ending, where)];
  if (summary.clipped.length > 0) {
    lines.push(
      `The input was too loud in ${summary.clipped.join(', ')}. Lower the deck’s volume or the input gain and record it again.`,
    );
  }
  return lines;
}

function endingLine(ending: RecordingEnding, where: string): string {
  switch (ending) {
    case 'done':
      return `${where}.`;
    case 'cancelled':
      return `Recording cancelled. ${where}; the track in progress was not kept.`;
    case 'disconnected':
      return `The device was disconnected. ${where}; the track in progress was not kept.`;
    case 'input-lost':
      return `The audio input stopped, so recording stopped. ${where}; the track in progress was not kept. Check the cable or the audio interface, then record the rest again.`;
    case 'refused':
      return `The device refused a playback command, so recording stopped. ${where}.`;
    case 'failed':
      return `Recording stopped because of an unexpected error. ${where}; the track in progress was not kept. Check the device, then record the rest again.`;
    case 'save-failed':
      return `Recording stopped because a file could not be saved. ${where}. Check the folder and the free space, then record the rest again.`;
  }
}

const AN_HOUR = 3600;

/** A warning when a track is longer than an hour, which needs a lot of memory to record. */
export function longTrackWarning(tracks: readonly { readonly seconds: number }[]): string | null {
  return tracks.some((track) => track.seconds > AN_HOUR)
    ? 'A selected track is longer than an hour. Recording it needs several hundred megabytes of memory.'
    : null;
}
