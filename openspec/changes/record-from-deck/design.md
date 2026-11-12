# Design

## Context

- **Deck control:** `DiscReader` queues every device operation (reads, edits, uploads, playback controls) so they never interleave. Playback already supports `goto`, `play`, `pause`, `stop` and `playTrack`, and `status()` reports the state, the track under the head and the time into it. There is no go-to-time command, so recording always starts at a track's beginning.
- **Status polling:** the disc panel reads the status about once a second while the app is visible, and stops while it is hidden (playback spec).
- **Upload as a model:** `useUploadFlow` already blocks other work while it runs, holds a screen wake lock, and shows a progress dialog that cannot be dismissed by accident. Recording follows the same shape.
- **Saving files:** the app saves files today by creating a download link (`downloadText`). The desktop app denies every permission request except USB.
- **webminidisc:** its "Record" feature (MIT-licensed `recorderjs` plus a worker) stops the deck, goes to the track, plays until the deck reports the track at 0:00:01, pauses, goes to the track again, starts capturing, plays, sleeps for the track's length, then downloads a WAV per track.

## Goals / Non-Goals

**Goals:**

- One recording path in `packages/app` that works in the desktop app and in Chromium browsers.
- A capture that the next change (song recognition) can reuse for a short excerpt.
- No new runtime dependency.

**Non-Goals:**

- Sample-accurate track boundaries. The analogue path has latency, and the deck starts on its own clock. Files may carry a fraction of a second of silence at either end.
- Recording longer than the track (gapless joins between tracks).

## Decisions

### 1. Capture with `getUserMedia` and an `AudioWorklet`, not `MediaRecorder` or `recorderjs`

- **Capture:** `getUserMedia({ audio: { deviceId, channelCount: 2, sampleRate: 44100, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. When the sample-rate constraint is refused (`OverconstrainedError`), the app retries without it, as webminidisc does. If the opened track still reports echo cancellation, noise suppression or automatic gain as on, the input is released and refused, since it would change the music.
- **Worklet:** an `AudioWorkletNode` posts each block of stereo samples to the page.
- **Conversion:** the page converts each block to 16-bit integers as it arrives and appends it to the current track's buffer. A 10-minute stereo track is about 106 MB at 44.1 kHz, which fits in memory; float samples would double that.
- **WAV encoding:** `encodeWav(samples, sampleRate, channels)` writes the 44-byte RIFF header. It is a pure function with unit tests.
- **Level meter:** the meter reads the peak of each block, so the setup and progress dialogs share one source.

Alternatives:

- `MediaRecorder` produces Opus/WebM, not PCM, so it would need decoding before WAV.
- `recorderjs` is unmaintained since 2016 and uses the deprecated `ScriptProcessorNode`.

**Worklet loading:** the module is bundled by Vite (`new URL('./capture.worklet.ts', import.meta.url)`) and served from the app's origin. That satisfies both CSPs (`script-src 'self'`) and the web app's cross-origin isolation.

### 2. Starting a track: prime, rewind, capture, play

The order is the same as webminidisc's, run through `DiscReader`'s queue:

1. Stop, go to the track and play.
2. Poll the status until the deck reports that track at 0:00 or 0:01 (at most 10 s), then pause and go to the track again.
3. Start the capture, then play.

Priming makes the deck spin up and load the track, so the real `play` starts almost at once, and the capture starts just before it rather than seconds early.

The capture runs for the track's length plus 1.5 s, measured on the audio clock (the count of samples received), not with timers. Timers are throttled in hidden tabs; the sample count is not. The session then stops the capture and, after the last track, stops the deck.

Alternative: stop when the status shows the next track. That works only while status polling runs, and it stops while the app is hidden.

### 3. Saving: a recording folder from the platform, downloads as the fallback

The app asks the platform for a recording folder once at start (`Platform.recordingFolder`): `choose()` returns a folder with a `name` and `write(fileName, parts, signal)`, or null when the user cancels. The parts are the WAV header and the sample chunks as they were captured, written in batches of about 4 MB, so a long track is never copied whole. A write that fails or is cancelled removes the file, so no partial recording is left in the folder. A platform with no folder access leaves it undefined, and each finished track is downloaded instead, with the download helper generalised to a `Blob`. Unique names (` (2)`, ` (3)`…) come from one pure function, `uniqueFileName(name, exists)`, in `packages/core`, used by both implementations.

- **Web app:** `showDirectoryPicker({ mode: 'readwrite' })` (Chrome, Edge and other Chromium browsers), then `getFileHandle(name, { create: true })` and a writable stream per file; on failure or cancel the stream is aborted and the entry removed.
- **Desktop app:** a narrow bridge in the preload, `recordings.chooseFolder()`, then `create(folderId, fileName)`, `append(fileId, bytes)`, `finish(fileId)` and `discard(fileId)`. The main process shows the native folder dialog, keeps the chosen path and each open file behind opaque ids, refuses a file name with a path separator, `..`, a control character or more than 255 bytes, and creates the file with the `wx` flag under a free name, so an existing file is never opened. `discard` closes and removes a file that will not be completed. The renderer never sees or sends a path.

Why not `showDirectoryPicker` in Electron as well: the spike on Electron 44 (task 1.1) found that it rejects at once with `AbortError`, shows no dialog and sends no permission request, even with the window in front and a user gesture.

### 4. Desktop permissions

- **Request handler:** it grants, only for the app origin (`isAppOrigin`), `media` when every requested media type is `audio`.
- **Check handler:** it answers `media` for audio from the app origin the same way, and keeps answering `usb` as today. The spike saw checks for `media` (audio, video and unspecified) and `speaker-selection`, and one request with `mediaTypes: ["audio"]`.
- **Everything else** stays denied: other permissions, video, and other origins.
- **macOS:** `electron-builder.yml` adds `mac.extendInfo.NSMicrophoneUsageDescription`. Without it, macOS kills the app the first time it captures audio. macOS then asks the user once; the answer can be changed later in System Settings → Privacy & Security → Microphone.
- **Windows:** desktop apps need "Let desktop apps access your microphone" on (Settings → Privacy → Microphone). The setup dialog's refused-permission message names it.
- **Linux:** capture goes through PulseAudio or PipeWire; no packaging change. The deb and AppImage builds need no extra permission.

### 5. Web app

- **Headers:** none needed. The CSP has no `media-src` limit on capture, there is no `Permissions-Policy` header (the microphone is allowed for the page itself), and the worklet is same-origin.
- **Permission:** the browser asks for microphone permission per origin.
- **Folders:** Chromium browsers support `showDirectoryPicker`. A browser without it falls back to downloads.

### 6. Blocking other work, and unplug

- **Blocking:** the recording session marks the disc panel busy, like an upload, so the edit, upload and player blockers say "Wait for the recording to finish."
- **Status polling** pauses while recording, so it cannot interleave with the session's own status reads. The session reads the status itself while priming.
- **Unplug:** the connection controller's disconnect handling unmounts the disc panel. The session listens for that abort, stops the capture and reports the files already saved.
- **Input lost:** when the input's track ends (an unplugged USB interface, a revoked permission), the capture rejects, the deck is stopped, and the summary says the input stopped and keeps the files already saved.

### 7. File names

`recordingFileName(track, disc)` is a pure function:

- the zero-padded number (two digits, three when the disc has 100 tracks or more), then the half-width title, then the full-width title in parentheses;
- `Track NN` when the track is untitled;
- `\ / : * ? " < > |` and control characters replaced by `-`, trailing dots and spaces trimmed (Windows), and the result limited to 200 characters.

## Risks / Trade-offs

- **The desktop folder bridge widens the privileged API:** it is limited to a folder the user picked in a native dialog during the session. The main process validates every file name and never overwrites a file, and the renderer cannot name a path.
- **Start offset:** the deck may take a moment to start after `play`, so a recording can begin with up to about a second of silence, and the 1.5 s margin can catch the start of the next track. → This is documented in the dialog. Trimming is out of scope.
- **Memory:** a very long LP4 track (over 60 minutes) needs about 600 MB of samples. → The setup dialog warns when a selected track is longer than 60 minutes. Streaming to disk is left for later.
- **Input level:** clipping or a very low level ruins a recording, and the app cannot fix either. → The live meter in setup and during recording, and a peak warning in the summary when a track clipped.
- **Background tabs:** Chromium keeps audio capture running in hidden tabs, but may throttle the page's timers. → The capture is timed by sample count (decision 2), and the wake lock keeps the screen on.
