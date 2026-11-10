/** An item of a track's context menu. */
export interface TrackAction {
  readonly id: 'play' | 'rename' | 'delete' | 'move-up' | 'move-down';
  readonly label: string;
  /** Why the action cannot run now, or null when it can. */
  readonly reason: string | null;
}

export interface TrackMenuState {
  readonly trackCount: number;
  /** Why editing is unavailable (`editBlocker`), or null. */
  readonly editBlocker: string | null;
  /** Why the player cannot be used (`playerBlocker`), or null. */
  readonly playBlocker: string | null;
  readonly playState: 'playing' | 'paused' | 'none';
}

/**
 * The context menu of a zero-based track: the same actions and reasons as the player and the
 * toolbar, for that track alone.
 */
export function trackActions(track: number, state: TrackMenuState): TrackAction[] {
  const edit = state.editBlocker;
  return [
    {
      id: 'play',
      label: state.playState === 'playing' ? 'Pause' : 'Play',
      reason: state.playBlocker,
    },
    { id: 'rename', label: 'Rename', reason: edit },
    { id: 'delete', label: 'Delete', reason: edit },
    {
      id: 'move-up',
      label: 'Move up',
      reason: edit ?? (track === 0 ? 'This is the first track.' : null),
    },
    {
      id: 'move-down',
      label: 'Move down',
      reason: edit ?? (track === state.trackCount - 1 ? 'This is the last track.' : null),
    },
  ];
}

/** The track that holds focus after a menu action: the moved track follows its new position. */
export function trackAfterAction(track: number, action: TrackAction['id']): number {
  if (action === 'move-up') return track - 1;
  if (action === 'move-down') return track + 1;
  return track;
}
