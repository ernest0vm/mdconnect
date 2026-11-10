import type { EditOutcome } from './disc-reader';
import type { GroupTracksResult } from './edit-plan';

export type Selection = ReadonlySet<number>;

export function toggleTrack(selection: Selection, track: number): Selection {
  const next = new Set(selection);
  if (next.has(track)) next.delete(track);
  else next.add(track);
  return new Set([...next].sort((a, b) => a - b));
}

/** "1 track", "3 tracks". */
export function trackCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'track' : 'tracks'}`;
}

export function selectionLabel(selection: Selection): string {
  if (selection.size === 0) return 'No tracks selected';
  return `${trackCountLabel(selection.size)} selected`;
}

export function selectAllState(selection: Selection, trackCount: number): 'none' | 'some' | 'all' {
  if (selection.size === 0) return 'none';
  return selection.size >= trackCount ? 'all' : 'some';
}

/**
 * The final position of a track dragged from `from` and dropped before or after the row at
 * `over`. Positions after `from` shift up by one once the track is taken out.
 */
export function moveDestination(from: number, over: number, side: 'before' | 'after'): number {
  if (side === 'before') return over > from ? over - 1 : over;
  return over >= from ? over : over + 1;
}

/** Why editing is unavailable right now, or null when it is available. */
export function editBlocker(state: { writeProtected: boolean; busy: boolean }): string | null {
  if (state.writeProtected) return 'The disc is write-protected. Slide its tab to edit it.';
  if (state.busy) return 'Wait for the current change to finish.';
  return null;
}

type GroupProblem = Extract<GroupTracksResult, { kind: 'invalid' }>['reason'];

export function groupBlocker(reason: GroupProblem): string {
  switch (reason) {
    case 'empty':
      return 'Select the tracks to group.';
    case 'not-consecutive':
      return 'Select consecutive tracks to group them.';
    case 'already-grouped':
      return 'Some selected tracks are already in a group.';
  }
}

type FailureReason = Extract<EditOutcome, { kind: 'failed' }>['reason'];

export function editFailureMessage(reason: FailureReason): string {
  switch (reason) {
    case 'rejected':
      return 'The device refused the change, so it could not be saved. The disc is shown as the device reports it.';
    case 'unsupported-title':
      return 'The title has characters the disc cannot store, so nothing was saved. Edit the title and try again.';
    case 'failed':
      return 'The device stopped answering while the change was saved. The disc is shown as the device reports it; check it before trying again.';
  }
}
