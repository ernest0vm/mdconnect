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
- [ ] 3.3 Record a rename, a move and a group rewrite on the MZ-NE410 with a scratch disc, anonymise the titles, and add a replay test. Verify that the test passes byte for byte. This is a manual recording; steps: connect the MZ-NE410 with a scratch disc, run the recording script from the read-disc-contents fixtures with the edit plan, then save the JSON in `packages/netmd/src/fixtures/`.

## 4. UI primitives in `packages/ui`

- [ ] 4.1 Add `GlassInput` and `GlassCheckbox`: native elements with GlassyUI styling, visible focus and light and dark tokens. Verify with component tests for label association and the checked and indeterminate states, and check contrast in both appearances.

## 5. Editing UI in `packages/app`

- [ ] 5.1 Add track selection to the track list: row checkboxes, select all, clear, and a count. Verify with component tests for pointer and keyboard selection (disc-editing: "Select several tracks", "Select all").
- [ ] 5.2 Add the Rename disc and Rename track dialogs: half-width and full-width fields, a converted preview, remaining characters, and Save disabled when the title does not fit. Verify with component tests (disc-editing: "Rename a disc", "Rename a track", "Full-width track title", "Accented title", "Title too long for the disc").
- [ ] 5.3 Add the Delete confirmation dialog stating the count and that it cannot be undone. Verify with component tests for confirm and cancel (disc-editing: "Delete after confirming", "Cancel deleting").
- [ ] 5.4 Add drag and drop reordering, plus Move up and Move down with focus following the track. Verify with component tests for the keyboard path and the drop handler (disc-editing: "Drag a track", "Move with the keyboard").
- [ ] 5.5 Add the Group, Rename group and Ungroup actions. Verify with component tests (disc-editing: "Group tracks", "Non-consecutive selection", "Ungroup").
- [ ] 5.6 Disable editing with a reason for a write-protected disc and during a read or edit, and show a readable message for failed edits. Verify with component tests (disc-editing: "Write-protected disc", "Edit in progress", "Device rejects an edit").

## 6. Integration and hardware checks

- [ ] 6.1 Manual verification on the MZ-NE410 with a scratch disc, in the desktop app and in the web app on Chrome:
  1. Rename the disc and a track, including an accented title and a full-width title.
  2. Select two tracks, delete them, and confirm the count.
  3. Drag a track and move one with the keyboard.
  4. Group three tracks, rename the group, and ungroup it.
  5. Unplug and replug, then confirm that every change is still on the disc.
  6. Eject the disc and check it in the device's own display.
- [ ] 6.2 Manual verification of the unavailable states: a write-protected disc disables editing (disc-editing: "Write-protected disc"); unplugging during a delete returns to the Connect screen (disc-editing: "Unplugged while editing").
- [ ] 6.3 Add the Sharp disc-title path and the TOC-flush question to issue #8 as untested items. Verify that the issue lists them.
