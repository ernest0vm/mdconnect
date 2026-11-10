import { FRAMES_PER_SECOND, type Disc, type Group, type Track } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import {
  deleteTracksPlan,
  groupTracksPlan,
  moveTrackPlan,
  renameDiscPlan,
  renameGroupPlan,
  renameTrackPlan,
  ungroupPlan,
  type EditCommand,
} from './edit-plan';

function track(index: number, title = `T${String(index + 1)}`): Track {
  return {
    index,
    title,
    fullWidthTitle: '',
    duration: 60 * FRAMES_PER_SECOND,
    channel: 0,
    encoding: 0x90,
    flags: 0,
  };
}

/** A disc from a layout like `[null, 'A', 'A', null]`: the group title of each track, in order. */
function disc(layout: (string | null)[], title = 'Mix'): Disc {
  const tracks = layout.map((_, i) => track(i));
  const groups: Group[] = [];
  const ungrouped = tracks.filter((_, i) => layout[i] === null);
  if (ungrouped.length > 0) groups.push({ title: null, fullWidthTitle: null, tracks: ungrouped });
  layout.forEach((name, i) => {
    if (name === null) return;
    const last = groups.at(-1);
    const current = tracks[i];
    if (current === undefined) return;
    if (last?.title === name && last.tracks.at(-1)?.index === i - 1) {
      groups[groups.length - 1] = { ...last, tracks: [...last.tracks, current] };
    } else {
      groups.push({ title: name, fullWidthTitle: null, tracks: [current] });
    }
  });
  return {
    title,
    fullWidthTitle: '',
    writable: true,
    writeProtected: false,
    used: 0,
    left: 0,
    total: 0,
    trackCount: tracks.length,
    groups,
  };
}

/** The expected disc as a layout of `title:group` per position, for readable assertions. */
function layoutOf(result: Disc): string[] {
  const rows: [number, string][] = [];
  for (const group of result.groups) {
    for (const t of group.tracks) rows.push([t.index, `${t.title}:${group.title ?? '-'}`]);
  }
  return rows.sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

const groupsWrite = (commands: readonly EditCommand[]) => commands.at(-1);

describe('renameDiscPlan and renameTrackPlan', () => {
  it('renames the disc, keeping the full-width title unless given (disc-editing: "Rename a disc")', () => {
    expect(renameDiscPlan('Road trip').commands).toEqual([
      { kind: 'renameDisc', title: 'Road trip', fullWidthTitle: undefined },
    ]);
  });

  it('writes the half-width title, and the full-width one when given (disc-editing: "Rename a track")', () => {
    expect(renameTrackPlan(2, 'Intro').commands).toEqual([
      { kind: 'setTrackTitle', track: 2, title: 'Intro', fullWidth: false },
    ]);
    expect(renameTrackPlan(0, 'Dawn', '夜明け').commands).toEqual([
      { kind: 'setTrackTitle', track: 0, title: 'Dawn', fullWidth: false },
      { kind: 'setTrackTitle', track: 0, title: '夜明け', fullWidth: true },
    ]);
  });
});

describe('deleteTracksPlan', () => {
  it('erases from the highest index down (disc-editing: "Delete after confirming")', () => {
    const plan = deleteTracksPlan(disc([null, null, null, null, null]), [1, 2]);
    expect(plan.commands.slice(0, 2)).toEqual([
      { kind: 'eraseTrack', track: 2 },
      { kind: 'eraseTrack', track: 1 },
    ]);
    expect(layoutOf(plan.expected)).toEqual(['T1:-', 'T4:-', 'T5:-']);
  });

  it('keeps the remaining tracks in their groups (disc-editing: "Groups after deleting")', () => {
    const plan = deleteTracksPlan(disc(['A', 'A', 'A', null]), [1]);
    expect(layoutOf(plan.expected)).toEqual(['T1:A', 'T3:A', 'T4:-']);
    expect(groupsWrite(plan.commands)).toEqual({ kind: 'rewriteGroups', disc: plan.expected });
  });

  it('drops a group whose tracks are all deleted', () => {
    const plan = deleteTracksPlan(disc([null, 'A', 'A']), [1, 2]);
    expect(plan.expected.groups.map((g) => g.title)).toEqual([null]);
  });
});

describe('moveTrackPlan', () => {
  it('moves a track to its final position (disc-editing: "Drag a track")', () => {
    const plan = moveTrackPlan(disc([null, null, null, null, null]), 4, 1);
    expect(plan.commands[0]).toEqual({ kind: 'moveTrack', from: 4, to: 1 });
    expect(layoutOf(plan.expected)).toEqual(['T1:-', 'T5:-', 'T2:-', 'T3:-', 'T4:-']);
  });

  it('joins a group when dropped between two of its tracks (disc-editing: "Move into a group")', () => {
    const plan = moveTrackPlan(disc(['A', 'A', null]), 2, 1);
    expect(layoutOf(plan.expected)).toEqual(['T1:A', 'T3:A', 'T2:A']);
  });

  it('leaves its group when moved away from it', () => {
    const plan = moveTrackPlan(disc(['A', 'A', null, null]), 0, 3);
    expect(layoutOf(plan.expected)).toEqual(['T2:A', 'T3:-', 'T4:-', 'T1:-']);
  });

  it('stays in its group when moved to the edge of the group', () => {
    const plan = moveTrackPlan(disc(['A', 'A', 'A', null]), 0, 2);
    expect(layoutOf(plan.expected)).toEqual(['T2:A', 'T3:A', 'T1:A', 'T4:-']);
  });

  it('does nothing for a move to the same place', () => {
    expect(moveTrackPlan(disc([null, null]), 1, 1).commands).toEqual([]);
  });
});

describe('groupTracksPlan', () => {
  it('groups consecutive ungrouped tracks (disc-editing: "Group tracks")', () => {
    const plan = groupTracksPlan(disc([null, null, null, null, null, null]), [3, 4, 5], 'Live');
    if (plan.kind !== 'plan') throw new Error(plan.kind);
    expect(layoutOf(plan.expected)).toEqual([
      'T1:-',
      'T2:-',
      'T3:-',
      'T4:Live',
      'T5:Live',
      'T6:Live',
    ]);
  });

  it('refuses a non-consecutive selection (disc-editing: "Non-consecutive selection")', () => {
    expect(groupTracksPlan(disc([null, null, null]), [0, 2], 'X')).toEqual({
      kind: 'invalid',
      reason: 'not-consecutive',
    });
  });

  it('refuses tracks that are already in a group', () => {
    expect(groupTracksPlan(disc(['A', null]), [0, 1], 'X')).toEqual({
      kind: 'invalid',
      reason: 'already-grouped',
    });
  });
});

describe('renameGroupPlan and ungroupPlan', () => {
  it('renames the group that starts at a track', () => {
    const plan = renameGroupPlan(disc([null, 'A', 'A']), 1, 'Side B', 'ビー');
    const renamed = plan.expected.groups.find((g) => g.tracks[0]?.index === 1);
    expect(renamed?.title).toBe('Side B');
    expect(renamed?.fullWidthTitle).toBe('ビー');
  });

  it('ungroups, keeping the tracks on the disc (disc-editing: "Ungroup")', () => {
    const plan = ungroupPlan(disc([null, 'A', 'A']), 1);
    expect(layoutOf(plan.expected)).toEqual(['T1:-', 'T2:-', 'T3:-']);
    expect(plan.commands).toEqual([{ kind: 'rewriteGroups', disc: plan.expected }]);
  });
});

describe('recovery after a partial delete', () => {
  it('rewrites the groups for the tracks actually erased', () => {
    const plan = deleteTracksPlan(disc([null, null, 'A', 'A', 'A']), [0, 1]);
    // Track 2 (index 1) was erased, then erasing index 0 failed.
    const recovery = plan.recovery?.(1) ?? [];
    expect(recovery).toHaveLength(1);
    const rewrite = recovery[0];
    if (rewrite?.kind !== 'rewriteGroups') throw new Error('expected a group rewrite');
    expect(layoutOf(rewrite.disc)).toEqual(['T1:-', 'T3:A', 'T4:A', 'T5:A']);
  });

  it('needs no recovery when nothing was erased', () => {
    expect(deleteTracksPlan(disc([null, 'A']), [0]).recovery?.(0)).toEqual([]);
  });

  describe('layout plans check the disc title field', () => {
    it('marks a plan whose groups all fit', () => {
      expect(moveTrackPlan(disc([null, 'A', 'A']), 0, 2).fits).toBe(true);
    });

    it('marks a plan that would lose a group as not fitting', () => {
      const tight = disc(['A', 'A', null]);
      const titled: Disc = {
        ...tight,
        groups: tight.groups.map((g) => ({
          ...g,
          tracks: g.tracks.map((t) => (t.index === 2 ? { ...t, title: 'x'.repeat(7 * 252) } : t)),
        })),
      };
      // The track titles fill the title area, so the group entry cannot be written.
      expect(moveTrackPlan(titled, 2, 1).fits).toBe(false);
    });
  });
});
