# Tasks

## 1. Device commands

- [ ] 1.1 Port `eraseDisc` into `NetMdInterface`. Verify with a query test for the bytes and a rejected reply.
- [ ] 1.2 Add the `eraseDisc` edit command and `wipeDiscPlan()` (stop, then erase), run through `DiscReader.edit`. Verify with tests for the command order and the read that follows (disc-editing: "Wipe after confirming").
- [ ] 1.3 Add `DiscSession.end()` (reset, release, close; errors ignored) and `DiscReader.close()`, queued behind work in progress. Verify with tests for an exit during an edit (app-menu: "Exit during an edit").

## 2. CSV

- [ ] 2.1 Add `formatCsv` and `parseCsv` in `features/disc/csv.ts`. Verify with tests for:
  - a grouped disc;
  - commas;
  - the older 8-column format;
  - the `HIMD ALBUM` and `HIMD ARTIST` header names;
  - a refused file;
  - reading back what was written.

  Also verify with a file exported by webminidisc (disc-csv: "Export a grouped disc", "Commas in titles", "Older format", "Not a supported file").

- [ ] 2.2 Add `reviewImport` and `importPlan`. Verify with tests for:
  - a matching disc;
  - a different track count;
  - a mismatched duration or mode;
  - skipped tracks;
  - groups from the file;
  - a plan that does not fit.

  (disc-csv: "Import onto a matching disc", "Different track count", "Mismatched track", "Too many characters".)

## 3. Menu and dialogs

- [ ] 3.1 Add `@radix-ui/react-dropdown-menu`, pinned to a version that passes the age gate, and `GlassMenu` in `packages/ui`. Verify that lint and typecheck pass and that the menu works with the keyboard in the browser (app-menu: "Open with the keyboard").
- [ ] 3.2 Add the More menu to the connected header, with unavailable items and their reasons. Verify the availability logic with unit tests (app-menu: "Unavailable item"; disc-editing: "Write-protected disc").
- [ ] 3.3 Add the Wipe confirmation, the Import review dialog, the About dialog and Exit through `ConnectionController.exit()`. Verify the view logic with unit tests. Check each in the browser with the demo device: Wipe and Import are rejected by the demo, so check that their failures read well (app-menu: "About", "Exit"; disc-editing: "Cancel wiping").

## 4. Targets and checks

- [ ] 4.1 Check the CSV download in the desktop app: a save dialog appears and the file is written. Change the navigation lock only if it blocks the `blob:` URL, with a main-process test. Check the download in Chrome too.
- [ ] 4.2 Manual verification with a working NetMD device:
  1. Wipe a scratch disc.
  2. Export, rename tracks, import, and confirm the titles and groups return.
  3. Exit, then connect again.

  Add what cannot run on the available hardware to issue #8.
