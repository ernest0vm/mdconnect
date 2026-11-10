import { describe, expect, it } from 'vitest';

import {
  editBlocker,
  editFailureMessage,
  groupBlocker,
  moveDestination,
  planBlocker,
  selectAllState,
  selectionLabel,
  toggleTrack,
} from './editing';

describe('selection (disc-editing: "Select several tracks", "Select all")', () => {
  it('toggles a track in and out', () => {
    const one = toggleTrack(new Set(), 1);
    expect([...toggleTrack(one, 3)]).toEqual([1, 3]);
    expect([...toggleTrack(one, 1)]).toEqual([]);
  });

  it('describes the selection', () => {
    expect(selectionLabel(new Set())).toBe('No tracks selected');
    expect(selectionLabel(new Set([2]))).toBe('1 track selected');
    expect(selectionLabel(new Set([2, 4]))).toBe('2 tracks selected');
  });

  it('reports whether none, some or all tracks are selected', () => {
    expect(selectAllState(new Set(), 12)).toBe('none');
    expect(selectAllState(new Set([1]), 12)).toBe('some');
    expect(selectAllState(new Set(Array.from({ length: 12 }, (_, i) => i)), 12)).toBe('all');
  });
});

describe('moveDestination', () => {
  it('drops before a later row at the position just above it', () => {
    expect(moveDestination(1, 4, 'before')).toBe(3);
  });

  it('drops before an earlier row at its position (disc-editing: "Drag a track")', () => {
    expect(moveDestination(4, 1, 'before')).toBe(1);
  });

  it('drops after a row', () => {
    expect(moveDestination(1, 4, 'after')).toBe(4);
    expect(moveDestination(4, 1, 'after')).toBe(2);
  });
});

describe('editBlocker (disc-editing: "Write-protected disc", "Edit in progress")', () => {
  it('blocks a write-protected disc', () => {
    expect(editBlocker({ writeProtected: true, busy: false })).toBe(
      'The disc is write-protected. Slide its tab to edit it.',
    );
  });

  it('blocks while the disc is read or written', () => {
    expect(editBlocker({ writeProtected: false, busy: true })).toBe(
      'Wait for the current change to finish.',
    );
  });

  it('allows editing otherwise', () => {
    expect(editBlocker({ writeProtected: false, busy: false })).toBeNull();
  });
});

describe('groupBlocker (disc-editing: "Non-consecutive selection")', () => {
  it('explains why the selection cannot be grouped', () => {
    expect(groupBlocker('not-consecutive')).toBe('Select consecutive tracks to group them.');
    expect(groupBlocker('already-grouped')).toBe('Some selected tracks are already in a group.');
    expect(groupBlocker('empty')).toBe('Select the tracks to group.');
  });
});

describe('editFailureMessage (disc-editing: "Device rejects an edit")', () => {
  it('explains a rejected change without a raw error', () => {
    expect(editFailureMessage('rejected')).toMatch(/could not be saved/u);
    expect(editFailureMessage('failed')).toMatch(/stopped answering/u);
    expect(editFailureMessage('unsupported-title')).toMatch(/cannot store/u);
  });
});

describe('planBlocker', () => {
  it('stops a plan whose groups would not fit in the disc title field', () => {
    expect(planBlocker({ commands: [], expected: {} as never, fits: false })).toMatch(/no room/u);
  });

  it('lets other plans run', () => {
    expect(planBlocker({ commands: [], expected: {} as never, fits: true })).toBeNull();
    expect(planBlocker({ commands: [] })).toBeNull();
  });
});
