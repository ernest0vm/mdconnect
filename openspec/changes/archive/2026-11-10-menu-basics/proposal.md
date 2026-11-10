# Proposal

## Why

webminidisc's main menu offers several small but often used actions that mdconnect lacks:

- **Wipe Disc**, to erase a whole disc before reusing it;
- **Export titles to CSV** and **Import titles from CSV**, to back up a disc's titles, edit them in a spreadsheet and write them back;
- **About**, with credits and license;
- **Exit**, to end the session with the device.

They need no audio code and, except Wipe Disc, can be checked without a working device. That makes them the next step toward webminidisc parity while the test device is out of order.

## What Changes

- **A menu button** ("More") in the connected header, with Export titles to CSV, Import titles from CSV, Wipe disc, About and Exit. Refresh stays where it is and covers webminidisc's Reload TOC.
- **Wipe disc:**
  - a confirmation that names the disc and says every track will be erased and cannot be recovered;
  - then playback stops, the disc is erased and read again;
  - unavailable for a write-protected disc or while a change is saving.
- **Export titles to CSV:**
  - writes webminidisc's CSV format (same columns and escaping), so files move between the two apps;
  - the file is named after the disc title.
- **Import titles from CSV:**
  - reads webminidisc's CSV, both the current and the older 8-column format;
  - compares it with the disc and shows a review before writing anything: track count, and any track whose duration or mode differs. The user can skip those tracks;
  - then applies the disc title, the track titles and the groups as one edit. The title space and group checks from disc-editing apply.
- **About:**
  - the app version and build commit, and the GPL-2.0 notice with the source link;
  - credits to webminidisc and netmd-js (Stefano Brilli and Asivery) and to the GlassyUI design system.
- **Exit:**
  - ends the NetMD session: USB reset, release and close, as webminidisc's Exit does;
  - returns to the Connect screen. The device stays granted, so Connect reconnects without a chooser where the platform allows.
- Same behaviour in the desktop app and the web app. The desktop app saves the CSV through a save dialog.

Out of scope:

- Settings. There is nothing to set yet beyond Appearance, which already has its own control. It comes with upload, whose options it would hold.
- Changelog, since the project has no releases yet.
- Song recognition, homebrew mode and the other homebrew items.
- Album and artist columns: they belong to Hi-MD titles. They are exported empty and ignored on import.
- Upload, download and recording.

## Capabilities

### New Capabilities

- `app-menu`: the connected screen's menu, the About dialog, and ending the session with Exit.
- `disc-csv`: exporting a disc's titles and groups to CSV and importing them back, compatible with webminidisc.

### Modified Capabilities

- `disc-editing`: adds Wipe disc.

## Impact

- **`packages/netmd`:** ports `eraseDisc` from netmd-js 4.4.1, with attribution.
- **`packages/app`:**
  - a CSV module (pure: format, parse, compare with a disc, build an edit plan) with tests;
  - the menu, the Wipe, Import review and About dialogs;
  - Exit through the connection controller;
  - the reader queue gains wipe and the session end.
- **`packages/ui`:** a `GlassMenu` primitive built on `@radix-ui/react-dropdown-menu` (see design.md).
- **`apps/desktop`:** handle the CSV download with a save dialog, if Electron's default does not already.
- **`apps/web`:** no changes expected.
