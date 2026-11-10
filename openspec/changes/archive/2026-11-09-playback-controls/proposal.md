# Proposal

## Why

A NetMD device connected to mdconnect can be read and edited, but not played. webminidisc has a player bar: previous, play, pause, stop and next, plus a display with the current track, its title and the elapsed time. Users rely on it to check a track after renaming or moving it, without picking up the device. It is also the second item on the webminidisc parity list after editing.

## What Changes

- **A player bar** in the connected layout with Previous, Play or Pause, Stop and Next.
- **A now-playing display:**
  - the track number, its title (or "Untitled") and the elapsed time;
  - the state: playing, paused, stopped, fast-forward or rewind, reading the disc, or no disc.
- **Play a track from the list:** an action on a track row starts playback at that track. A row shows when its track is playing or paused.
- **Device status kept current:** while a device is connected and the app is in the foreground, the app reads the playback status about once a second. It reads it right after each control as well.
- **Next and Previous fallback:** some devices reject these commands. webminidisc then stops, goes to the neighbouring track and plays, and mdconnect does the same.
- **Unavailable controls:** they are disabled with a reason while no disc is inserted, while the disc is being read, and while an edit is being saved. Playback commands never interleave with reads or edits.
- **`packages/netmd`:** the playback and status commands from netmd-js 4.4.1:
  - `play`, `pause`, `stop`, `nextTrack`, `previousTrack`, `gotoTrack`;
  - `getPosition`, `getPlaybackStatus2`;
  - `getDeviceStatus`, with its operating-status table.
- Same behaviour in the desktop app and the web app.

Out of scope:

- Seeking within a track (`gotoTime`) and fast-forward or rewind buttons. A later change can add a seek bar.
- Eject.
- Volume, which NetMD does not control.
- Playing audio on the computer, or downloading tracks.
- An LCD-style animated display or SonicStage theming.
- Hi-MD playback.

## Capabilities

### New Capabilities

- `playback`: controlling playback on a connected NetMD device and showing what it is playing. That covers the player controls, playing a track from the list, the now-playing display, keeping the status current, and when the controls are unavailable.

### Modified Capabilities

None. `disc-contents` and `disc-editing` keep their behaviour; the player only shares their read and edit queue.

## Impact

- `packages/netmd`: new playback and status commands, ported with attribution, with query tests and a recorded replay.
- `packages/app`:
  - the reader queue (`DiscReader`) gains playback commands and status reads;
  - a status poller that pauses while the window is hidden;
  - a `PlayerBar` component and a now-playing indicator on track rows.
- `apps/desktop`, `apps/web`: no code changes expected.
- This change builds on `responsive-layout` (PR #14) for where the player bar sits, and should land after it.
