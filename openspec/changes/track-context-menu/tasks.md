# Tasks

## 1. Component

- [x] 1.1 Add `@radix-ui/react-context-menu`, pinned to the newest version past the age gate, and `GlassContextMenu` in `packages/ui` with the same item and reason styles as `GlassMenu`. Verify that lint and typecheck pass and that repo-policy accepts the dependency.

## 2. Track menu

- [x] 2.1 Add `trackActions(track, state)` in the disc view logic: items, labels (Play or Pause) and reasons. Verify with unit tests (track-context-menu: "Pause a playing track", "Write-protected disc", "First track").
- [x] 2.2 Make rows focusable with a roving `tabIndex`, wrap each row in the context menu, and select the row on open. Wire the items to the existing dialogs and plans. Check in the browser with `?demo`, by mouse and keyboard (track-context-menu: "Right-click", "Keyboard", "Rename from the menu").

## 3. Manual verification

- [ ] 3.1 In the desktop app, right-click a row and check that only mdconnect's menu appears, not Electron's. Check that Delete from the menu asks for confirmation.
