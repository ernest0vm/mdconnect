import { groupsFit, type Disc, type Group, type Track } from '@mdconnect/netmd';

/** One change to send to the device, in the order a plan lists them. */
export type EditCommand =
  | {
      readonly kind: 'renameDisc';
      readonly title: string;
      readonly fullWidthTitle: string | undefined;
    }
  | {
      readonly kind: 'setTrackTitle';
      readonly track: number;
      readonly title: string;
      readonly fullWidth: boolean;
    }
  | { readonly kind: 'eraseTrack'; readonly track: number }
  | { readonly kind: 'moveTrack'; readonly from: number; readonly to: number }
  /** Stops playback; a device that rejects it is ignored. */
  | { readonly kind: 'stop' }
  /** Erases every track and title on the disc. */
  | { readonly kind: 'eraseDisc' }
  /** Rewrites the disc title fields so they store this disc's title and groups. */
  | { readonly kind: 'rewriteGroups'; readonly disc: Disc };

export interface EditPlan {
  readonly commands: readonly EditCommand[];
  /**
   * Commands that put the disc title back in line when the plan stops after `completed`
   * commands, for example group ranges after some of the erases went through.
   */
  readonly recovery?: (completed: number) => readonly EditCommand[];
}

/** A plan that changes the track order or the groups, with the disc it should leave. */
export interface LayoutPlan extends EditPlan {
  readonly expected: Disc;
  /**
   * Whether the disc title field can hold every group and the disc title afterwards. The
   * compiler leaves out what does not fit, so a plan that does not fit must not run.
   */
  readonly fits: boolean;
}

/** Erases the whole disc, after stopping playback, as webminidisc's Wipe Disc does. */
export function wipeDiscPlan(): EditPlan {
  return { commands: [{ kind: 'stop' }, { kind: 'eraseDisc' }] };
}

/** Renames the disc; the full-width title is left alone unless given. */
export function renameDiscPlan(title: string, fullWidthTitle?: string): EditPlan {
  return { commands: [{ kind: 'renameDisc', title, fullWidthTitle }] };
}

/** Renames a track; the full-width title is written only when given. */
export function renameTrackPlan(track: number, title: string, fullWidthTitle?: string): EditPlan {
  const commands: EditCommand[] = [{ kind: 'setTrackTitle', track, title, fullWidth: false }];
  if (fullWidthTitle !== undefined) {
    commands.push({ kind: 'setTrackTitle', track, title: fullWidthTitle, fullWidth: true });
  }
  return { commands };
}

interface GroupName {
  readonly title: string;
  readonly fullWidthTitle: string | null;
}

/** The disc as a list of positions, each with its track and the id of its group (or null). */
interface Layout {
  readonly disc: Disc;
  readonly slots: { readonly track: Track; readonly group: number | null }[];
  readonly names: Map<number, GroupName>;
}

/** The disc as positions with group ids, sorted by track index. */
function layoutOf(disc: Disc): Layout {
  const slots: Layout['slots'] = [];
  const names = new Map<number, GroupName>();
  disc.groups.forEach((group, id) => {
    if (group.title !== null)
      names.set(id, { title: group.title, fullWidthTitle: group.fullWidthTitle });
    for (const track of group.tracks)
      slots.push({ track, group: group.title === null ? null : id });
  });
  slots.sort((a, b) => a.track.index - b.track.index);
  return { disc, slots, names };
}

/** Builds the disc a layout describes, numbering tracks by position as the device will. */
function discOf({ disc, slots, names }: Layout): Disc {
  const tracks = slots.map((slot, index) => ({ ...slot.track, index }));
  const groups: Group[] = [];
  const ungrouped = tracks.filter((_, i) => slots[i]?.group === null);
  if (ungrouped.length > 0) groups.push({ title: null, fullWidthTitle: null, tracks: ungrouped });
  let lastId: number | null = null;
  tracks.forEach((track, i) => {
    const id = slots[i]?.group ?? null;
    const name = id === null ? undefined : names.get(id);
    if (id === null || name === undefined) {
      lastId = null;
      return;
    }
    const last = groups.at(-1);
    if (id === lastId && last !== undefined) {
      groups[groups.length - 1] = { ...last, tracks: [...last.tracks, track] };
    } else {
      groups.push({ title: name.title, fullWidthTitle: name.fullWidthTitle, tracks: [track] });
    }
    lastId = id;
  });
  return { ...disc, trackCount: tracks.length, groups };
}

/** A plan that runs `commands` and then rewrites the groups for the resulting layout. */
function layoutPlan(commands: EditCommand[], layout: Layout): LayoutPlan {
  const expected = discOf(layout);
  return {
    commands: [...commands, { kind: 'rewriteGroups', disc: expected }],
    expected,
    fits: groupsFit(expected),
  };
}

/**
 * Erases tracks from the highest index down, so the indexes still to erase stay valid. The plan
 * fits only if every layout it can stop at fits: a failed erase leaves the disc part way, and the
 * recovery then writes the groups for that layout.
 */
export function deleteTracksPlan(disc: Disc, tracks: readonly number[]): LayoutPlan {
  const doomed = [...new Set(tracks)].sort((a, b) => b - a);
  const layout = layoutOf(disc);
  const afterErasing = (erased: readonly number[]): Layout => ({
    ...layout,
    slots: layout.slots.filter((slot) => !erased.includes(slot.track.index)),
  });
  const plan = layoutPlan(
    doomed.map((track) => ({ kind: 'eraseTrack', track })),
    afterErasing(doomed),
  );
  const everyStepFits = doomed.every((_, i) =>
    groupsFit(discOf(afterErasing(doomed.slice(0, i + 1)))),
  );
  return {
    ...plan,
    fits: everyStepFits,
    // The erased tracks are the first `completed` of `doomed`; regroup for exactly those.
    recovery: (completed) => {
      const erased = doomed.slice(0, Math.min(completed, doomed.length));
      if (erased.length === 0) return [];
      return [{ kind: 'rewriteGroups', disc: discOf(afterErasing(erased)) }];
    },
  };
}

/**
 * Moves a track to its final position `to`. A track stays in its group if it lands next to
 * another track of that group; otherwise it joins a group it lands inside, or no group.
 */
export function moveTrackPlan(disc: Disc, from: number, to: number): LayoutPlan {
  const layout = layoutOf(disc);
  if (from === to) return { commands: [], expected: disc, fits: true };
  const slots = [...layout.slots];
  const [moved] = slots.splice(from, 1);
  if (moved === undefined) return { commands: [], expected: disc, fits: true };
  slots.splice(to, 0, moved);
  const left = slots[to - 1]?.group ?? null;
  const right = slots[to + 1]?.group ?? null;
  let group: number | null = null;
  if (moved.group !== null && (left === moved.group || right === moved.group)) group = moved.group;
  else if (left !== null && left === right) group = left;
  slots[to] = { ...moved, group };
  return layoutPlan([{ kind: 'moveTrack', from, to }], { ...layout, slots });
}

export type GroupTracksResult =
  | ({ readonly kind: 'plan' } & LayoutPlan)
  | { readonly kind: 'invalid'; readonly reason: 'empty' | 'not-consecutive' | 'already-grouped' };

/** Groups consecutive tracks that are in no group under a new title. */
export function groupTracksPlan(
  disc: Disc,
  tracks: readonly number[],
  title: string,
  fullWidthTitle?: string,
): GroupTracksResult {
  const selected = [...new Set(tracks)].sort((a, b) => a - b);
  const first = selected[0];
  if (first === undefined) return { kind: 'invalid', reason: 'empty' };
  if (selected.some((track, i) => track !== first + i)) {
    return { kind: 'invalid', reason: 'not-consecutive' };
  }
  const layout = layoutOf(disc);
  if (selected.some((track) => layout.slots[track]?.group !== null)) {
    return { kind: 'invalid', reason: 'already-grouped' };
  }
  const id = Math.max(-1, ...layout.names.keys()) + 1;
  const names = new Map(layout.names).set(id, { title, fullWidthTitle: fullWidthTitle ?? null });
  const slots = layout.slots.map((slot) =>
    selected.includes(slot.track.index) ? { ...slot, group: id } : slot,
  );
  return { kind: 'plan', ...layoutPlan([], { ...layout, slots, names }) };
}

/** The id of the group that holds the track at `firstTrack`, or null. */
function groupAt(layout: Layout, firstTrack: number): number | null {
  return layout.slots[firstTrack]?.group ?? null;
}

/** Renames the group that contains `track`. The full-width title is kept unless given. */
export function renameGroupPlan(
  disc: Disc,
  track: number,
  title: string,
  fullWidthTitle?: string,
): LayoutPlan {
  const layout = layoutOf(disc);
  const id = groupAt(layout, track);
  const names = new Map(layout.names);
  const current = id === null ? undefined : names.get(id);
  if (id !== null && current !== undefined) {
    names.set(id, { title, fullWidthTitle: fullWidthTitle ?? current.fullWidthTitle });
  }
  return layoutPlan([], { ...layout, names });
}

/** Removes the group that contains `track`; its tracks stay on the disc in no group. */
export function ungroupPlan(disc: Disc, track: number): LayoutPlan {
  const layout = layoutOf(disc);
  const id = groupAt(layout, track);
  const slots = layout.slots.map((slot) =>
    id !== null && slot.group === id ? { ...slot, group: null } : slot,
  );
  return layoutPlan([], { ...layout, slots });
}
