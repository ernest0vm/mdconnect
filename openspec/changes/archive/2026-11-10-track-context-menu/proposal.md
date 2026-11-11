## Why

webminidisc opens a menu with Play, Rename and Delete when a track is right-clicked. In mdconnect those actions are only in the toolbar, after selecting the track, which is slower for one-off actions on one track.

## What Changes

- **Opening the menu:** right-clicking a track row, or pressing the context-menu key or Shift+F10 on a focused row, opens a menu for that track.
- **Items:**
  - **Play** (or **Pause** when the track is playing);
  - **Rename**;
  - **Delete**;
  - **Move up** and **Move down**.

  They reuse the existing actions and dialogs. An unavailable item says why, as in the More menu: a write-protected disc, a change in progress, or the first or last track.

- **Selection:** opening the menu on a row that is not selected selects that track alone, so the actions act on the track shown.

### Out of scope

- Group and Ungroup from the context menu: they act on several selected tracks and stay in the toolbar.
- Context menus for groups or the disc.

## Capabilities

### New Capabilities

- `track-context-menu`: the per-track context menu, its items, availability and keyboard access.

### Modified Capabilities

(none: the actions behave as the `disc-editing` and `playback` specs already require)

## Impact

- `packages/ui`: `GlassContextMenu`, a wrapper of `@radix-ui/react-context-menu` styled like `GlassMenu`.
- `packages/app`: `TrackTable` wraps each row. `DiscEditor` passes the existing actions in.
- New dependency: `@radix-ui/react-context-menu` (MIT), the sibling of the dropdown menu already used.
