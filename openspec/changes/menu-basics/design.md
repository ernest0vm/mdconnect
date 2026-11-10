# Design

## Context

- The connected screen (app-layout) has a header with the device, Connect another device and Appearance.
- `DiscReader` is the device's one queue for reads, edits, playback commands and status reads. Edits are plans (`EditPlan`) checked with `groupsFit` before they run.
- **webminidisc's CSV:**
  - **Columns:** `INDEX, GROUP RANGE, GROUP NAME, GROUP FULL WIDTH NAME, NAME, FULL WIDTH NAME, ALBUM, ARTIST, DURATION, ENCODING, BITRATE`. The older format has 8 columns, without ALBUM, ARTIST and BITRATE.
  - **Values:**
    - row 0 is the disc;
    - `INDEX` is 1-based;
    - `GROUP RANGE` is the zero-based first and last index (`3-5`), empty outside a group;
    - `DURATION` is `ceil(frames / 512)` seconds;
    - `ENCODING` is `SPS`, `SPM` or `AT3`, and `BITRATE` is `292`, `146`, `132` or `66`;
    - commas inside values are written `\,`.
  - **On import:** webminidisc compares each row with the disc, warns about a different track count, and accepts a duration within 2 s and the same codec and bitrate.
- `NetMdInterface` has no `eraseDisc` yet. webminidisc's Wipe Disc calls `stop()` and then `eraseDisc()`. Its Exit calls netmd-js `finalize()`: USB reset, release interface 0, close.

## Goals / Non-Goals

**Goals:**

- Files exported by either app import into the other.
- Import is one reviewed edit through the existing plan machinery, never a partial write the user did not see.
- Every menu action stays keyboard operable and says why it is unavailable.

**Non-Goals:**

- Album and artist, which are Hi-MD titles.
- Settings.
- A changelog.

## Decisions

### 1. Menu on Radix DropdownMenu

Add `GlassMenu` to `packages/ui`, wrapping `@radix-ui/react-dropdown-menu` with the GlassyUI surface styles. Radix gives the menu-button pattern: focus moves into the menu, arrow keys and typeahead work, and Escape returns focus to the trigger. That is the same reason `GlassDialog` uses Radix Dialog.

Disabled items use Radix's `disabled` plus a visible reason line under the label, because a disabled menu item cannot hold `aria-describedby` focus.

Alternative: a hand-built menu. Rejected: the keyboard and focus rules are easy to get wrong, and Radix is already the base of the dialog.

### 2. Wipe disc

- Port `eraseDisc` (`1840 ff 0000`, reply `1840 00 0000`) into `NetMdInterface`.
- A plan `wipeDiscPlan()` with commands `stop` and then `eraseDisc` runs through `DiscReader.edit`, so it queues behind reads and edits and is read again afterwards.
- `stop` is the playback command, which ignores a rejection. `eraseDisc` is a new `EditCommand` kind.
- The confirmation reuses the Delete dialog pattern: it names the disc, and focus starts on Cancel.

### 3. CSV as pure functions

A `features/disc/csv.ts` module:

- **`formatCsv(disc: Disc): string`** writes webminidisc's current format. Durations are seconds, rounded up. The encoding comes from `Encoding` and `Channels`. The disc row carries the used time in seconds, as webminidisc does.
- **`parseCsv(text): ParsedCsv | { error }`**:
  - splits lines, then cells on unescaped commas, and unescapes `\,`;
  - accepts the current header, including the `HIMD ALBUM` and `HIMD ARTIST` names, and the 8-column one;
  - refuses anything else.
- **`reviewImport(parsed, disc): ImportReview`** lists the track-count difference and the mismatched tracks, with both descriptions. It uses webminidisc's 2-second tolerance and its codec and bitrate comparison.
- **`importPlan(parsed, disc, skipped): LayoutPlan`** returns:
  - `renameDisc`;
  - `setTrackTitle` for each kept track whose titles differ;
  - one `rewriteGroups` for the groups in the file. Group ranges are zero-based, and rows outside the disc are ignored.

  The plan carries `fits` from `groupsFit` and is refused like any other layout plan.

The download is a `Blob` and an `<a download>` click, the same on both targets. The import uses an `<input type="file" accept=".csv,text/csv">`.

### 4. Desktop download

Electron shows a save dialog for downloads by default. The navigation lock (desktop-shell) must not block the `blob:` URL. If it does, the download is allowed for same-origin `blob:` URLs only, and a main-process test covers it. This is checked in task 4.1 before any code is added.

### 5. Exit

- `DiscReader.close()` queues behind work in progress, then calls a new `DiscSession.end()`.
- The session implements `end()` as netmd-js `finalize`: `device.reset()`, `releaseInterface(0)`, `close()`. Errors are ignored, as upstream does.
- `ConnectionController` gains `exit()`. It ends the session, clears the open device and dispatches a state that shows the Connect screen without the "Device unplugged" hint.
- The desktop app's device grant is unchanged, so Connect reconnects without a chooser. The web app keeps its grant too.

### 6. About

- `AboutDialog` shows `platform.buildCommit`, a version from `package.json` injected at build (as the commit is), the GPL-2.0 notice, the source link and the credits.
- It reuses `SourceFooter`'s link target, so the two never disagree.

## New dependencies

| Package                         | Purpose                         | License | Maintenance                                                                                                                                                               |
| ------------------------------- | ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@radix-ui/react-dropdown-menu` | Accessible menu button for More | MIT     | Maintained by WorkOS in the same Radix family as `@radix-ui/react-dialog`, already used. Released regularly. The version is pinned to one that passes the 7-day age gate. |

## Risks / Trade-offs

- **Wiping a disc is destructive and cannot be verified without a working device.** A confirmation names the disc, focus starts on Cancel, and query tests check the bytes. The hardware check is listed in #8.
- **Exit's USB reset did not make the MZ-NE410 write its TOC** (edit-disc findings). Exit only ends the session; the screen says changes are written when the device stops or the disc is ejected.
- **A CSV from another tool may have a slightly different format.** Only webminidisc's two headers are accepted, and other files are refused with a message.
