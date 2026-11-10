# Tasks

## 1. Shift-JIS and title helpers in `packages/netmd`

- [x] 1.1 Add a lazy Shift-JIS encoder built from `TextDecoder('shift_jis')`. Verify with tests that ASCII, half-width katakana and kanji round-trip with the decoder, and that unsupported characters are reported.
- [x] 1.2 Port `sanitizeHalfWidthTitle`, `sanitizeFullWidthTitle`, `getHalfWidthTitleLength` and accent stripping (design decision 3). Verify with tests for "Te Lloré un Río" → "Te Llore un Rio", "★" → space, kana conversion with dakuten, and `ø`/`ß` (disc-editing: "Accented title", "Unsupported character").
- [x] 1.3 Port `getRemainingCharactersForTitles` and `compileDiscTitles` with the two fixes from design decision 1. Verify with tests on a grouped disc, a disc with one-track groups, a full-width disc, and a disc whose groups no longer fit (disc-editing: "Title too long for the disc").

## 2. Write commands in `packages/netmd`

- [x] 2.1 Pass the vendor ID to the interface (`InterfaceOptions.vendorId`). Port `setDiscTitle` (including the Sharp `0x04dd` path), `setTrackTitle`, `eraseTrack` and `moveTrack`, with reply checks. Verify with query tests that each sends the netmd-js bytes and that a rejected reply throws `NetMdRejectedError`.
- [x] 2.2 Port `renameDisc`, keeping groups for half-width and full-width titles. Verify with tests: rename with groups, add a title to a groups-only disc, clear the title (disc-editing: "Rename a grouped disc", "Clear the disc title").
- [x] 2.3 Export the new API from `index.ts` and update the package README. Verify that `yarn workspace @mdconnect/netmd typecheck` and the tests pass.

## 3. Edit plans in `packages/app`

- [x] 3.1 Add pure plan builders for rename disc, rename track, delete, move, group, rename group and ungroup. Each returns the command list and the expected disc. Verify with tests for: deletes ordered from the highest index down, group ranges after delete and move, moving into and out of a group, rejecting a non-consecutive or overlapping group (disc-editing: "Delete after confirming", "Groups after deleting", "Drag a track", "Move into a group", "Group tracks", "Non-consecutive selection", "Ungroup").
- [x] 3.2 Add `DiscReader.edit(plan)`: queued with reads, always reads the disc again, reopens the session after a failure, and returns the outcome with the new read. Verify with tests for an edit while a read is in flight, a rejected command followed by a fresh read, and Refresh during an edit (disc-contents: "Read again after an edit"; disc-editing: "Device rejects an edit", "Edit in progress").
- [x] 3.3 Record a rename, a move and a group rewrite on the MZ-NE410, anonymise the titles, and add a replay test. Verify that the test passes byte for byte. Recorded in the desktop app with a recorder on `USBDevice` control transfers; saved as `packages/netmd/src/fixtures/mz-ne410-edits.json` and replayed in `recorded.test.ts`.

## 4. UI primitives in `packages/ui`

- [x] 4.1 Add `GlassInput` and `GlassCheckbox`: native elements with GlassyUI styling, visible focus and light and dark tokens. Verify in the running app (6.1) that labels, the checked and mixed states and the focus ring work, and that contrast passes in both appearances.

## 5. Editing UI in `packages/app`

- [x] 5.1 Add track selection to the track list: row checkboxes, select all, clear, and a count. Verify with tests of the selection logic (`editing.test.ts`) (disc-editing: "Select several tracks", "Select all").
- [x] 5.2 Add the Rename disc and Rename track dialogs: half-width and full-width fields, a converted preview, remaining characters, and Save disabled when the title does not fit. Verify with tests of the title form (`title-form.test.ts`; disc-editing: "Rename a disc", "Rename a track", "Full-width track title", "Accented title", "Title too long for the disc").
- [x] 5.3 Add the Delete confirmation dialog stating the count and that it cannot be undone. Verify confirm and cancel in the running app (6.1; disc-editing: "Delete after confirming", "Cancel deleting").
- [x] 5.4 Add drag and drop reordering, plus Move up and Move down with focus following the track. Verify with tests of the drop position (`editing.test.ts`) and the move plan (`edit-plan.test.ts`) (disc-editing: "Drag a track", "Move with the keyboard").
- [x] 5.5 Add the Group, Rename group and Ungroup actions. Verify with tests of the group plans and messages (`edit-plan.test.ts`, `editing.test.ts`) (disc-editing: "Group tracks", "Non-consecutive selection", "Ungroup").
- [x] 5.6 Disable editing with a reason for a write-protected disc and during a read or edit, and show a readable message for failed edits. Verify with tests of the blockers and messages (`editing.test.ts`) (disc-editing: "Write-protected disc", "Edit in progress", "Device rejects an edit").

## 6. Integration and hardware checks

- [ ] 6.1 Manual verification on the MZ-NE410 with a scratch disc, in the desktop app and in the web app on Chrome:
  1. Rename the disc and a track, including an accented title and a full-width title.
  2. Select two tracks, delete them, and confirm the count.
  3. Drag a track and move one with the keyboard.
  4. Group three tracks, rename the group, and ungroup it.
  5. Unplug and replug, then confirm that every change is still on the disc.
  6. Eject the disc and check it in the device's own display.

  Results on 2026-11-09, desktop app, MZ-NE410 with a 37-track LP2 disc (web app not run yet):

  - Steps 1, 3 and 4 passed. The device accepted every command and reported the change when the disc was read again. Covered: the accented rename ("Te Lloré un Río" stored as "Te Llore un Rio"), move up and down, drag both ways, grouping, a full-width group title ("テスト") and ungrouping. Every change was undone afterwards. The light and dark appearances were checked in the dialogs.
  - Step 2: confirm and cancel work. In a session that had already edited the disc, the device rejected the erase (`0a`). In a fresh session it accepted it.
  - Steps 5 and 6 failed on this device. It stays in "Edit" after the session, even after Stop or a USB reset. After unplugging, ejecting and reinserting, the disc showed none of the changes, including a delete made with webminidisc, and the device hung until its battery was removed. This points to the device's TOC write (write head), not to mdconnect. Persistence stays unverified; tracked in #8.

- [ ] 6.2 Manual verification of the unavailable states: a write-protected disc disables editing (disc-editing: "Write-protected disc"); unplugging during a delete returns to the Connect screen (disc-editing: "Unplugged while editing").
- [x] 6.3 Add the Sharp disc-title path, persistence after unplugging, a successful delete after other edits, and the web app run to issue #8 as untested items. Verify that the issue lists them.
