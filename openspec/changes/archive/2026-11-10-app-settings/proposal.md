## Why

webminidisc has a Settings dialog. mdconnect's choices are scattered: Appearance has its own header button, and the upload defaults only change inside the convert dialog. Once given, consent to the online encoder can never be withdrawn.

## What Changes

- The header's **Appearance** button becomes **Settings**, available on every screen as before. It opens one dialog with three sections:
  - **Appearance:** theme and transparency, the current controls moved here unchanged.
  - **Titles:** "Full-width titles" turns the full-width (Japanese) title fields on or off in the rename dialogs and the convert dialog. It is on by default, which keeps today's behaviour.
  - **Uploads:** the defaults the convert dialog starts with, namely recording mode, title source, ReplayGain and LP encoder. It also shows whether audio may be sent to the online encoder, with a button to withdraw that consent.
- The convert dialog reads and writes the same stored preferences, so a choice made in either place shows in both.

### Out of scope

- webminidisc's homebrew settings (ATRAC ripping, exploit options, archive ZIP), which have nothing to apply to yet.
- webminidisc's "stretch to fill the screen" options. mdconnect's layout already adapts to the window.
- The disc-protected warning dialog. mdconnect shows the write-protected reason next to each unavailable action instead.
- Installing other encoders.

## Capabilities

### New Capabilities

- `app-settings`: the Settings dialog, its sections, and how its choices are stored and applied.

### Modified Capabilities

- `ui-theme`: the Appearance control moves into Settings. The theme and transparency choices are unchanged.

`track-upload` is not yet a main spec (`upload-tracks` is still open), so the upload defaults and consent withdrawal are stated in `app-settings`.

## Impact

- `packages/app`:
  - `PageShell` replaces the Appearance button with Settings;
  - a new `features/settings` (dialog and view logic);
  - the upload preferences store gains withdrawal of consent;
  - the title dialogs and the convert dialog read the full-width setting.
- No new dependencies. The same choices are stored in `localStorage` as today, under the same keys, so existing choices survive.
