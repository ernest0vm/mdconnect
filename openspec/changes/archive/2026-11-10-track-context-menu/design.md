# Design

## Context

- `TrackTable` renders one `TrackRow` per track, with a checkbox, a play button and drag-to-move. `DiscEditor` owns the selection, the dialogs and the edit plans. `editBlocker` and `playerBlocker` give the reasons actions are unavailable.
- The More menu uses `GlassMenu` (`@radix-ui/react-dropdown-menu`), with a visible reason line on disabled items.

## Goals / Non-Goals

**Goals:** the same actions, availability and reasons as the toolbar and player, reachable from the row by mouse and keyboard.

**Non-Goals:** multi-track actions in the menu.

## Decisions

### 1. Radix Context Menu

- `@radix-ui/react-context-menu` opens on right-click and on the context-menu key / Shift+F10 when its trigger has focus. It gives the same focus handling and typeahead as the dropdown already used.
- `GlassContextMenu` reuses `GlassMenu`'s item and reason styles, so both menus look the same.
- **Dependency:** MIT, maintained by WorkOS, same family and version line as `@radix-ui/react-dropdown-menu`. It is pinned to the newest version past the 7-day age gate, and needs no install scripts.

Alternative: open the existing dropdown at the pointer. Rejected: no built-in keyboard trigger, and positioning would have to be done by hand.

### 2. Rows are the trigger

Each `TrackRow` becomes the menu trigger through `asChild`. Rows are made focusable with a roving `tabIndex`, so a keyboard user can reach a row and press Shift+F10. Arrow keys move between rows; that is a small addition to the existing table.

### 3. Actions are passed in, not duplicated

`DiscEditor` passes the per-track handlers and reasons it already computes (rename dialog, delete dialog, move, play or pause) through a `trackActions(track)` function. The menu renders them, so availability rules live in one place (`editing.ts`, `player-view.ts`).

### 4. Platforms

Both apps render the same component. In Electron the default context menu is not shown on rows, because Radix prevents it. Elsewhere it is unchanged.

## Risks / Trade-offs

- **Roving focus changes keyboard navigation in the table** → Tab still reaches the toolbar and the table once. Arrow keys move between rows, and existing controls inside a row stay reachable with Tab.
