# Design

## Context

- `packages/netmd` reads and edits the disc. It has `getStatus`, but none of the playback commands or the playback status queries netmd-js has.
- In `packages/app`, `DiscReader` owns the NetMD session and a queue (`exclusive`) that keeps reads and edits from interleaving.
- The responsive layout (PR #14) gives the connected screen a header, a disc summary and a track area that fills the window.
- webminidisc does the following:
  - `control()` calls the netmd-js command, waits 500 ms and reads `getDeviceStatus()`.
  - It polls the status in the background.
  - For Next and Previous it falls back to stop, `gotoTrack(±1)` and play when the device rejects them.
  - A double click on a track row starts playback at that track.

## Goals / Non-Goals

**Goals:**

- Send the same commands netmd-js sends, so devices behave as they do with webminidisc.
- Keep one queue per device for reads, edits, controls and status reads.
- Keep status polling cheap and stop it when nobody is looking.

**Non-Goals:**

- Seeking, fast-forward and rewind controls, and eject.
- Tracking time between polls beyond showing the last reported time. An optional client-side tick between polls is left to a later change.

## Decisions

### 1. Port the playback commands into `packages/netmd`

Port these from netmd-js 4.4.1, with attribution headers:

- **Into `NetMdInterface`:**
  - `play`, `pause` (both through `_play` with `Action.play` or `Action.pause`);
  - `stop`, which, like upstream, ignores a failure (LAM-1 fix);
  - `nextTrack`, `previousTrack` (`_trackChange`), `gotoTrack`, `getPosition`, `getPlaybackStatus2`.
- **Into a new `status.ts`:** `getDeviceStatus`, with its operating-status table. The result is `{ discPresent, state, track, time }`, with `time` in minutes, seconds and frames.

Deviations from upstream, recorded in the file headers:

- `getPosition` returns null on a rejected reply, as upstream does. Other errors pass through, which is also upstream behaviour, now stated.
- The operating-status table is an exhaustive TypeScript `Record` with an `unknown` fallback.

Query tests check each command's bytes. A replay test uses a recorded play, next and stop session from the MZ-NE410, if the device works again (see the risks).

### 2. One queue for everything a device does

`DiscReader` becomes the device's command queue. Renaming the class is out of scope, so its docs are updated instead. It gains:

- `control(command)`:
  - runs the command, then waits 500 ms, then reads the status, all inside the queue;
  - for `next` or `previous` rejected by the device, it runs the fallback (stop, `gotoTrack(track ± 1)`, play) using the last known status;
  - it returns the new status, or a failure reason (`rejected` or `failed`).
- `status()`:
  - a status read in the queue, shared like `read()` so two callers never read twice;
  - it reopens the session after a transport failure, like a disc read. A device that refuses the status queries keeps its session, so polling does not reopen it every second.

Playback commands are plain values: `{ kind: 'play' } | { kind: 'pause' } | { kind: 'stop' } | { kind: 'next' } | { kind: 'previous' } | { kind: 'goto', track } | { kind: 'playTrack', track }`. `playTrack` is webminidisc's goto followed by play, as one step in the queue. They sit next to `EditCommand` but are not `EditCommand`s, because they do not change the disc and need no re-read.

Alternative: a separate session for playback. Rejected: one USB interface means one queue (edit-disc design, decision 5).

### 3. Polling

A `useDeviceStatus(reader)` hook:

- calls `reader.status()` every 1 s while `document.visibilityState === 'visible'`;
- stops on `visibilitychange` to hidden and resumes on visible;
- skips a tick while the previous status read is still in flight (the queue already serializes it);
- after a control, takes the status that `control()` returned instead of waiting for the next tick.

The timer and visibility source are injected, so tests run without real time.

Desktop and web behave the same. Electron fires `visibilitychange` when the window is minimized or hidden. Polling `getDeviceStatus` costs three queries a second, as in webminidisc. If it delays a Refresh or an edit, that is by at most one status read.

### 4. Player UI

- **`PlayerBar`** sits at the bottom of the disc summary at every width. Below `lg` the summary is above the list and keeps its height, so the player stays in view while the list scrolls; a separate bar under the header was not needed.
- **Inside the bar:**
  - icon buttons with text labels for assistive technology: Previous, Play or Pause, Stop, Next;
  - the now-playing text, "004 · Intro · 1:23", in a polite live region that only announces a change of track or state, not every second;
  - the state as a short word next to it.
- **Track rows** get a Play action, shown on hover and focus and always available to keyboard and screen-reader users. The current track's row shows a playing or paused indicator, and its name says so.
- **Disabled controls** use the same `Action` pattern as the edit toolbar: focusable, `aria-disabled`, with a described reason.

### 5. Both targets

The same code runs in both. The demo device (`?demo`) has no recorded playback replies, so its controls are rejected with the readable message. A recorded playback session can be added to the demo later.

## New dependencies

None. Icons are inline SVG in `packages/ui`, not an icon library.

## Risks / Trade-offs

- [Polling competes with edits and reads for the USB interface] → Everything goes through one queue, and polling stops while the window is hidden.
- [Devices differ in `getPosition` and playback status replies; some reject them] → `getDeviceStatus` treats a rejected position as no track and an unknown status as `unknown`, and the player shows what it can.
- [The test MZ-NE410 is currently hung (#8)] → Commands are checked byte for byte against netmd-js. Hardware verification waits for a working device, and the change can land with that recorded as open, as edit-disc did.
- [An announcement every second would be noisy] → The live region only changes on a track or state change; the time is not in it.
