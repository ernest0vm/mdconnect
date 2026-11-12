# Tasks

## 1. Desktop permissions and folder access

- [x] 1.1 Spike on Electron 44 (macOS, then Windows and Linux): call `showDirectoryPicker` and write a file from the app's page, and capture audio with `getUserMedia`. Record which permission requests (`media`, `fileSystem`) and events arrive. If folder access does not work, update design decision 3 to a narrow preload API before continuing. On macOS: audio capture works after one `media` request with `mediaTypes: ["audio"]` (checks also arrive for `media` audio and video, and `speaker-selection`); the built-in microphone gave 48 kHz mono despite asking for 44.1 kHz stereo. `showDirectoryPicker` rejects at once with `AbortError`, with no dialog and no permission request, so design decision 3 now uses a narrow preload API for the desktop app. Windows and Linux follow in 5.3.
- [x] 1.2 Grant `media` (audio-only requests) to the app origin in the request and check handlers, keeping USB as it is and denying everything else. Verify with unit tests on the handlers (desktop-shell: "Audio capture allowed", "Video refused", "Other permission refused").
- [x] 1.3 Add the recording-folder bridge: `recordings.chooseFolder()` (native dialog, opaque folder id) and `recordings.create(folderId, fileName)`, `append(fileId, bytes)`, `finish(fileId)` and `discard(fileId)` in the preload (a file is written in batches of about 4 MB, and removed when it cannot be completed), the main-process handlers with name validation and `uniqueFileName`, and the desktop platform's `recordingFolder`. Verify the main-process logic with unit tests on a temporary directory (desktop-shell: "Write into the chosen folder", "Path in a file name", "No folder picked").
- [x] 1.4 Add `NSMicrophoneUsageDescription` to the macOS build in `electron-builder.yml`. Verify with a repo-policy or config test that the key is present (desktop-shell: "macOS asks once").

## 2. Capture and files

- [x] 2.1 Add `encodeWav(samples, sampleRate, channels)` and the 16-bit conversion of float blocks. Verify with tests on the header fields, sample order and clipping (deck-recording: "One track").
- [x] 2.2 Add `recordingFileName(track, disc)`. Verify with tests (deck-recording: "File name", "Untitled track"), plus full-width titles, 100+ track discs, Windows-forbidden endings and the length limit.
- [x] 2.3 Add `uniqueFileName` in `packages/core`, the web platform's `recordingFolder` (`showDirectoryPicker`), and the download fallback (the download helper generalised to a `Blob`). Verify `uniqueFileName` and the web folder with a fake directory handle (deck-recording: "Name already taken", "Folder chosen once").
- [x] 2.4 Add the capture: the audio worklet module, the input stream with the constraints and the 44.1 kHz fallback, sample counting and the peak level. Verify the stream-constraint fallback and the block handling with unit tests on a fake stream and worklet port.

## 3. Recording session

- [x] 3.1 Add the session that records a list of tracks through `DiscReader` (prime, rewind, capture, play, stop on sample count) with a fake reader, capture and sink. Verify with tests (deck-recording: "Several tracks", "Deck stopped at the end", "Cancel", "Unplugged").
- [x] 3.2 Add the Record availability rule next to the other track-action blockers. Verify with tests (deck-recording: "Nothing selected", "Write-protected disc", and the busy and player-blocked cases).

## 4. Dialogs and wiring

- [x] 4.1 Add the setup dialog: cabling steps, input list, live level meter, the remembered input, and messages for refused permission and no input. Verify the view logic (messages and remembered input) with unit tests (deck-recording: "Remembered input", "Permission refused", "No input"). Check it in the browser with `?demo`, by keyboard.
- [x] 4.2 Add the progress and summary dialog. Verify the view logic with tests (deck-recording: "Progress", "Summary").
- [x] 4.3 Wire Record into the track toolbar, block editing, uploads and the player while recording, pause status polling, and hold the wake lock. Check in the browser with `?demo` that the controls are blocked with the recording reason (deck-recording: "Record selected tracks", "Controls blocked"). The demo device has no audio, so the recording itself is checked in 5. Checked with `?demo` (Record says "Select tracks to record them." with nothing selected; two selected tracks open "Record 2 tracks"; Escape returns focus to Record), then during real recordings in the desktop app and in Chrome: Rename, Delete, Add tracks, Play, Refresh and Record were all unavailable with "Wait for the recording to finish.".

## 5. Manual verification

- [ ] 5.1 **Desktop app on macOS:**
  1. Connect the deck's line-out (or headphone out) to the Mac's audio input, or through a USB audio interface.
  2. Record two short tracks into a new folder. Check that macOS asked for microphone access once, that the meter moved, and that the two WAV files play back with the right audio, names and lengths.
  3. Record again while the window is hidden for the whole of one track. Check that the file is complete.
  4. Cancel during the second of three tracks. Check that one file is saved and the deck stops.
  5. Unplug the deck during a recording. Check that the app reports it and keeps the earlier file.

  **Partly checked on 2026-11-12** with a Sony MZ-NE410 and the MacBook's built-in microphone as the input (no cable to the deck's output was at hand), recording tracks 15 (2:00) and 59 (2:38):
  - Step 2: the two files were saved as `15 paul van dick - love stimulation (club mix) (1).wav` and `59 Mirala Bien.wav`, 121.6 s and 159.6 s long (each track plus 1.5 s), 48 kHz mono 16-bit, which is what the built-in microphone offers. The native folder dialog opened in front. The packaged app (`yarn package`) made macOS ask for microphone access for mdconnect with the stated reason. The meter moved with the room sound.
  - Step 3: the page reported itself hidden for track 1, covered by other windows, and its file was complete. Minimizing the window over CDP did not work in Electron, so the window was covered, not minimized.
  - Step 4: cancelled at 10% of track 2 of 3. Only track 1's file was kept, the deck stopped, and the second file for track 15 was saved as `… (1) (2).wav` instead of overwriting the first.
  - Step 5: after unplugging during track 2 of 2, the Connect screen showed "Recording stopped — The device was disconnected. 1 file saved to “music-test”; the track in progress was not kept.", and track 1's file was complete.
  - Fixed on the way: Space on the focused Cancel button ended a recording (the dialog now focuses its status), Refresh was not blocked, and an unplugged recording was not reported.
  - **Still open:** step 1 and the audio itself, recording the deck's own output through a cable and checking the files sound right. This moves to the Windows laptop (5.3).

- [ ] 5.2 **Web app in Chrome**, on `yarn dev:web` and on production: repeat steps 2 and 4 of 5.1. Check the browser's microphone prompt and the folder picker. **Partly checked on `yarn dev:web`** (2026-11-12, MZ-NE410, built-in microphone): Chrome asked for microphone access, listed the inputs by name, and its folder picker wrote `22 allison-frajil.wav` (175.5 s) and `15 … (5).wav` (121.6 s) without overwriting. The first input chosen was the iPhone's microphone, so the setup now prefers the system's default input. **Still open:** production, which gets this change once it is merged, and step 4 in Chrome.
- [ ] 5.3 **Windows and Linux:** if they cannot be run here, add steps 5.1.2 and 5.1.4 to #8, with the Windows microphone privacy setting and a PipeWire or PulseAudio input. **Planned on the maintainer's HP Omen with Windows**, with the deck's output cabled to its audio input: steps 1–5 of 5.1 with real deck audio, the Windows microphone privacy setting, and 5.2 in Chrome there. Linux goes to #8.
