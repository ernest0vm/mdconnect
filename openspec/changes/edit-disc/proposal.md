# Proposal

## Why

mdconnect can read a disc but cannot change it, so it still falls short of webminidisc for everyday use: naming a disc, fixing track titles, removing or reordering tracks, and organising them into groups. These edits all write the same on-disc data (track and disc titles, with groups stored in the disc title), so they belong in one change. Uploading, playback and the rest of the webminidisc menu build on the write path this change adds.

## What Changes

- **Rename the disc**: half-width title, and an optional full-width (Japanese) title, as in webminidisc's Rename Disc.
- **Rename a track**: half-width and optional full-width title.
- **Select tracks** in the track list (one, several, or all).
- **Delete the selected tracks**, after a confirmation that names how many tracks will be erased. webminidisc deletes without asking; erasing audio cannot be undone, so mdconnect asks.
- **Move tracks**: drag a track to a new position, or move it up and down from the keyboard. Moving into or out of a group's range updates the groups.
- **Groups**: group the selected tracks under a new title, rename a group (half-width and full-width), and ungroup (the tracks stay on the disc). Groups stay valid after deletes and moves.
- Titles are converted to what the disc can store, as webminidisc does (for example accented letters lose their accents and unsupported characters become spaces), and the dialog shows the converted text before saving. Each title field shows how many characters are left on the disc.
- Editing is disabled, with a short reason, while the disc is write-protected, while no disc is inserted and while another edit or read is in progress.
- After each edit the disc is read again so the screen shows what the device actually stored.
- `packages/netmd` gains the write commands from netmd-js 4.4.1 (disc title, track title, erase track, move track), title sanitising, Shift-JIS encoding, title-space accounting and group compilation.
- Same behaviour in the desktop app and the web app.

Out of scope:

- Wipe Disc (erase the whole disc), Reload TOC beyond the existing Refresh, CSV import and export of titles: separate changes.
- Uploading, downloading or recording audio; playback controls.
- Homebrew and factory-mode features (TOC editing, ripping, song recognition).
- Undo of edits. Renames can be redone by hand; deleted audio cannot be recovered.
- Hi-MD discs in Hi-MD mode.

## Capabilities

### New Capabilities

- `disc-editing`: changing the contents of the disc in a connected NetMD device: disc, track and group titles, track selection, deletion, reordering and grouping, with title conversion, space limits and the states that disable editing.

### Modified Capabilities

- `disc-contents`: the track list gains selection and edit actions, and the screen reads the disc again after each edit. Reading and presenting requirements are otherwise unchanged.

## Impact

- `packages/netmd`: new write commands and title helpers, ported from netmd-js 4.4.1 (GPL-2.0, Stefano Brilli and Asivery) with upstream attribution in each file. Shift-JIS encoding is built without a new dependency (see design.md).
- `packages/app`: a disc editor service on top of the NetMD session, edit dialogs, selection, drag and keyboard reordering in `DiscPanel`, and test doubles that check the exact commands sent.
- `packages/ui`: possibly new shadcn/GlassyUI primitives (text input, checkbox, confirmation dialog) if the existing ones do not cover them.
- `apps/desktop`, `apps/web`: no code changes expected.
- Risk: a wrong write can corrupt a disc's table of contents. Commands are checked byte for byte against netmd-js in tests, and hardware checks use a scratch disc.
