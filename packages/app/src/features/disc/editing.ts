import { TrackFlag, type Disc } from '@mdconnect/netmd';

import type { EditOutcome } from './disc-reader';
import type { EditPlan, GroupTracksResult } from './edit-plan';

export type Selection = ReadonlySet<number>;

export function toggleTrack(selection: Selection, track: number): Selection {
  const next = new Set(selection);
  if (next.has(track)) next.delete(track);
  else next.add(track);
  return new Set([...next].sort((a, b) => a - b));
}

export function selectionLabel(selection: Selection): string {
  if (selection.size === 0) return 'No tracks selected';
  return `${String(selection.size)} ${selection.size === 1 ? 'track' : 'tracks'} selected`;
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

/**
 * Whether a plan erases a track marked as protected. Tracks transferred with SonicStage carry
 * this mark, and devices may refuse to erase them over USB.
 */
export function erasesProtectedTracks(plan: EditPlan, disc: Disc): boolean {
  const protectedTracks = new Set(
    disc.groups
      .flatMap((g) => g.tracks)
      .filter((t) => t.flags === PROTECTED)
      .map((t) => t.index),
  );
  return plan.commands.some((c) => c.kind === 'eraseTrack' && protectedTracks.has(c.track));
}

const PROTECTED: number = TrackFlag.protected;

export function editFailureMessage(reason: FailureReason, erasedProtected: boolean): string {
  if (reason === 'failed') {
    return 'The device stopped answering while the change was saved. The disc is shown as the device reports it; check it before trying again.';
  }
  return erasedProtected
    ? 'The device refused to erase these tracks. They are marked as protected, as tracks transferred with SonicStage are, and this device does not let them be erased over USB.'
    : 'The device refused the change, so it could not be saved. The disc is shown as the device reports it.';
}
