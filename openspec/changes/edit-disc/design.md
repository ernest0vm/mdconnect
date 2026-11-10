# Design

## Context

- `packages/netmd` is a read-only port of netmd-js 4.4.1: transport, query encoding, descriptor handling, and `listContent`, which parses groups out of the raw disc title (`0;Disc//1-2;Group//`).
- `packages/app` reads through `DiscReader`, which owns the NetMD session, shares a read already in progress and reopens the session after a failure. `DiscPanel` renders the result.
- Titles are decoded with `TextDecoder('shift_jis')`. The web platform has no Shift-JIS encoder.
- netmd-js gets Shift-JIS from `jconv` and accent stripping from `diacritics`. Its title helpers (`sanitizeHalfWidthTitle`, `sanitizeFullWidthTitle`, `getRemainingCharactersForTitles`, `compileDiscTitles`, `renameDisc`) live in `utils.ts` and `netmd-commands.ts`.
- `packages/ui` has a Radix-based `GlassDialog`, buttons, badges and alerts, but no text input or checkbox.

## Goals / Non-Goals

**Goals:**

- Send the same bytes netmd-js sends for each edit, so behaviour matches webminidisc on real devices.
- Keep one queue for reads and edits on a device, so commands never interleave.
- Compute the result of an edit (track order, groups, titles) as pure functions, testable without a device.

**Non-Goals:**

- A general command layer for later features (upload, playback). They add their own commands when they need them.
- Optimistic updates. The screen shows what the device reports after each edit.

## Decisions

### 1. Port the write path into `packages/netmd`

Port from netmd-js 4.4.1, with attribution headers as in the existing files:

- `NetMdInterface`: `getRawDiscTitle` (already ported), `setDiscTitle`, `setTrackTitle`, `eraseTrack`, `moveTrack`. Keep upstream's Sharp quirk: for vendor `0x04dd`, the disc title is written through the UTOC1 descriptor. The interface receives the device's vendor ID for this (`InterfaceOptions.vendorId`).
- Title helpers: half-width and full-width sanitising, length in Shift-JIS, remaining title space, group compilation, and disc rename that keeps groups.

Deviations from upstream, each recorded in the file header:

- `eraseTrack` and `moveTrack` check the reply status like every other command. Upstream ignores the reply.
- In `getRemainingCharactersForTitles`, a one-track group's range is `n` instead of `n` followed by the string `false`. This bug made upstream count 5 extra characters per one-track group.
- In `compileDiscTitles`, the final full-width length check multiplies by 7 like the half-width one.

Alternative: depend on `netmd-js`. Rejected earlier (read-disc-contents design): Yarn's `approvedGitRepositories` blocks its git dependencies, and it pulls Node polyfills into the web build.

### 2. Shift-JIS encoder without a dependency

Build the reverse table once, lazily, by decoding every one-byte code and every valid two-byte code (lead bytes 0x81–0x9F and 0xE0–0xFC, trail bytes 0x40–0x7E and 0x80–0xFC) with `TextDecoder('shift_jis')`. That is about 11,000 decodes, about 1 ms. Characters with no code encode as `?` and are reported as unsupported, so sanitising replaces them before any write.

Alternatives:

- `encoding-japanese` (MIT, maintained): about 250 KB of tables for one direction we can derive.
- `jconv`: unmaintained and needs Node's `Buffer`.

Both TextDecoders are WHATWG-standard. Chromium, Electron and Node with full ICU, which Vitest runs on, all provide `shift_jis`.

### 3. Accent stripping without `diacritics`

Use `normalize('NFD')` and remove combining marks (`\p{M}`), plus a small table for letters that do not decompose: `ø`, `æ`, `œ`, `ł`, `đ`, `ß`, `þ` and their capitals. This deviates from upstream for rarer letters the `diacritics` table covers; those become spaces instead. Tests pin the common European cases.

### 4. Edits as pure plans, applied in order

`packages/app` computes an edit plan from the current `Disc` and the user's action:

- the device commands, in order;
- the expected disc (track order and groups).

Then it applies the plan. The rules match webminidisc:

- **Delete**: erase the selected tracks from the highest index down, so earlier indexes stay valid. Then drop the deleted tracks from their groups and rewrite the disc title with the compiled groups.
- **Move**: one `moveTrack(from, to)`. Groups are recomputed by position:
  - a track dropped strictly inside a group's range joins that group;
  - a track that leaves its group's range leaves the group;
  - an empty group disappears.

  Then the disc title is rewritten.

- **Group, rename group, ungroup**: change only the group list, then rewrite the disc title.
- **Rename disc**: rewrite the title part before the groups (`renameDisc`), half-width and full-width separately.
- **Rename track**: `setTrackTitle` for the half-width title, and for the full-width title when it changed.

Plans are unit-tested against the exact command list netmd-js would send. A replay test checks the bytes against a recorded rename-and-move session from the MZ-NE410.

### 5. One queue: `DiscReader` runs edits

`DiscReader` gains `edit(plan)`:

- It waits for any read in progress.
- It runs the plan's commands on the same session.
- It always reads the disc again, even when a command fails, and returns the new read together with the edit's outcome.

On failure the session is reopened first, as for a failed read. While `edit` runs, `read()` shares it, so a Refresh click cannot interleave with it.

Alternative: a separate editor holding its own session. Rejected: two owners of one USB interface means interleaved control transfers.

### 6. UI

- **Track list:**
  - a checkbox per row, plus select-all and clear;
  - a toolbar: Rename disc, Rename, Delete, Group, Ungroup, Move up, Move down;
  - a selection count.
- **Dragging:** native HTML drag and drop on rows, which both targets support because they are Chromium. Move up and Move down are the keyboard path, and focus follows the moved track.
- **Dialogs:**
  - Rename and Group use `GlassDialog` with half-width and full-width fields, the converted preview and the remaining characters.
  - Delete uses a confirmation `GlassDialog`.
- **New primitives in `packages/ui`:** `GlassInput` and `GlassCheckbox`, styled native elements with no new dependency.

Alternative for dragging: `@dnd-kit` (MIT, maintained, keyboard sensor). Rejected for now: native drag plus explicit move buttons covers pointer and keyboard without a dependency. It can be revisited if multi-track drag is wanted.

### 7. Both targets

- Desktop and web run the same code. No platform code changes, because the WebUSB calls are the ones reading already uses.
- macOS, Windows and Linux behave the same, since nothing touches the filesystem or packaging. Windows device access stays the open question tracked in #8.

## New dependencies

None.

## Risks / Trade-offs

- [A wrong command corrupts the disc's TOC] → Plans are tested against netmd-js command lists, and the bytes against a recorded session. Hardware checks use a scratch disc. The app reads the disc again after every edit.
- [The TOC is written when the device stops or the disc is ejected, so unplugging right after an edit can lose it] → After an edit, say in the screen that changes are saved when the device finishes writing, as webminidisc does. Do not claim persistence beyond what the device reports.
- [Accent stripping differs from `diacritics` for rare letters] → Pinned by tests, and the dialog preview shows the result before saving.
- [Native drag and drop is coarse on touch screens] → Move up and Move down work everywhere.
- [Sharp devices use a different disc title path] → Ported as upstream. No Sharp device to test with; noted in #8.

## Open Questions

- Whether the MZ-NE410 needs the TOC flushed explicitly before unplugging, or a stop is enough. To be checked during hardware verification. It only affects the wording of the notice in the screen.
