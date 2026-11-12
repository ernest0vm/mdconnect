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
