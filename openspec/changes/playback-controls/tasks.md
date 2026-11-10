# Tasks

## 1. Playback commands in `packages/netmd`

- [x] 1.1 Port `play`, `pause`, `stop`, `nextTrack`, `previousTrack` and `gotoTrack` into `NetMdInterface`. Verify with query tests that each sends the netmd-js bytes, and that `stop` ignores a rejection.
- [x] 1.2 Port `getPosition` and `getPlaybackStatus2`, and add `getDeviceStatus` with the operating-status table in `status.ts`. Verify with tests for playing, paused, stopped, no disc, reading the disc, an unknown status, and a rejected position (playback: "Playing", "Stopped").
- [x] 1.3 Export the new API and update the package README. Verify that the netmd lint, typecheck and tests pass.

## 2. Device queue in `packages/app`

- [x] 2.1 Add `DiscReader.control(command)`: it runs in the queue, waits, then reads the status, and falls back to stop, goto and play when Next or Previous is rejected. Next on the last track and Previous on the first send nothing. Verify with tests (playback: "Play", "Pause", "Stop", "Next track", "Device without next and previous", "Last track", "Device rejects a control").
- [x] 2.2 Add `DiscReader.status()`: queued, shared while in flight, and reopening the session after a failure. Verify with a test that a status read waits for an edit and the read after it (playback: "Status during an edit").
- [x] 2.3 Add the `useDeviceStatus` polling logic with an injected timer and visibility source. Verify with tests that it polls once a second, skips while a read is in flight, stops while hidden and resumes when visible (playback: "Playback advances", "Hidden window").

## 3. Player UI

- [x] 3.1 Add the playback icons in `packages/ui` as inline SVG components. Verify that lint and typecheck pass.
- [x] 3.2 Add `PlayerBar`: controls, the now-playing text and state, disabled states with reasons, and a polite live region for track and state changes. Verify the view logic (the now-playing text, the state word, the control availability) with unit tests (playback: "Playing", "Stopped", "No disc").
- [x] 3.3 Place the player at the bottom of the disc summary (at every width; below `lg` the summary sits above the list, so the player stays in view). Add the per-row Play action and the playing or paused indicator. Verify with the demo device at 1200 × 800 and 375 × 812 that the controls are visible and the page does not scroll horizontally (playback: "Play a chosen track").

## 4. Hardware checks

- [ ] 4.1 Manual verification with a working NetMD device, in the desktop app and in the web app on Chrome. Steps:
  1. Play, pause, stop.
  2. Next and Previous, including the last and first tracks.
  3. Play a chosen track from the list.
  4. Let a track end and confirm the player follows to the next one within about two seconds.
  5. Hide the window for a minute and confirm, with the USB recorder, that no status reads were sent.
  6. Start an edit during playback and confirm that status reads wait for it.

  Record a play, next and stop session as an anonymised fixture with a replay test.

- [ ] 4.2 Add any steps that cannot run on the available hardware to issue #8.
