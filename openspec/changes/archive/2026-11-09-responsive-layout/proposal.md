# Proposal

## Why

Once a device is connected, mdconnect shows everything in one narrow card centered in the window: the device, the disc, the actions and a track list of up to 255 rows. On a desktop window or a wide browser most of the screen stays empty, and the list scrolls inside a box half the window high. On a phone the same card works but the toolbar crowds. SonicStage and webminidisc both use the whole window, with the device and disc on one side and the tracks filling the rest. mdconnect needs that structure before the next features (playback, upload, the rest of the webminidisc menu) add more controls.

## What Changes

- **Connected layout that uses the window**:
  - a header with the device name, its USB ID, Connect another device and Appearance;
  - a disc summary with the title, a capacity bar with used, free and total time, the write-protected badge, Rename disc and Refresh;
  - a track area that fills the remaining height and scrolls on its own.
- **Wide windows** (1024 CSS pixels and up):
  - two columns: the device and disc summary on the left, the track area on the right;
  - the grid keeps room for a local-files column, so upload can add it later.
- **Medium windows** (640 to 1023 pixels): one column, with the disc summary above a full-width track area.
- **Narrow windows** (below 640 pixels, down to 320):
  - one column without horizontal scrolling;
  - the toolbar wraps, and the recording mode moves under the title in each row.
- **Track area**:
  - column headings (#, Title, Duration, Mode) that stay visible while the list scrolls;
  - the selection toolbar stays visible too.

  Behaviour from edit-disc (selection, drag, dialogs) is unchanged.

- **Capacity bar**: a visual bar, with the same values as text for assistive technology.
- **Before connecting**: no layout change. The connect card stays centered: it holds little content.
- **Desktop window**:
  - opens at 1200 × 800;
  - has a minimum size of 480 × 560, so the layout never breaks.
- The GPL source footer stays visible on every screen. On the connected layout it moves to the bottom of the window.

Out of scope:

- A SonicStage-like theme (colours, icons, artwork). That is a later themes change. This one only sets the structure.
- The local-files column, transfer controls and upload.
- Playback controls and the now-playing display.
- The webminidisc menu (Wipe Disc, CSV, Settings, About and others).
- Changes to the unsupported-browser screen.

## Capabilities

### New Capabilities

- `app-layout`: how the app arranges its screens in the window, from 320 CSS pixels to wide desktop windows, including the connected layout, the track area and the desktop window size.

### Modified Capabilities

None. `disc-contents` and `disc-editing` keep what the screen shows and does. Where it sits belongs to the new capability.

## Impact

- `packages/app`:
  - `PageShell` gets a connected layout variant;
  - `ConnectScreen` renders the header and the columns when a device is open;
  - `DiscPanel` splits into a disc summary and a track area;
  - a new capacity bar.
- `packages/ui`: possibly a `GlassMeter` primitive for the capacity bar.
- `apps/desktop`: the default and minimum window size in the main process.
- `apps/web`: no code changes.
- This change builds on `edit-disc` (PR #13) and should land after it.
