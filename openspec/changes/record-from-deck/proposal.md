# Proposal

## Why

NetMD cannot copy tracks from a disc to the computer on most decks, so the only way to get the music off a MiniDisc is to play it and record the deck's line-out. webminidisc offers this as "Record". mdconnect has nothing for it yet, and the song-recognition work that comes next needs the same recording path to listen to a track.

## What Changes

- **Record:** a new action in the track toolbar records the selected tracks. For each track, the app starts the track on the deck from 0:00, records the computer's chosen audio input for the track's length, and saves the audio as a WAV file named after the track.
- **Setup step:** before recording, a dialog explains the cabling (deck line-out or headphone out to the computer's line-in), lets the user pick the audio input, and shows a live level meter so the user can set the deck's volume and the input gain. The chosen input is remembered.
- **Where files go:** the user picks a folder once per recording session, and every track is written there. Where folder access is not available, each file is downloaded instead.
- **While recording:** a progress dialog shows the track being recorded, its progress, the input level and a Cancel button. Editing, uploads and the player controls are unavailable until it ends, and the screen is kept on.
- **Desktop permissions:** the desktop app allows audio capture and folder access for its own pages, and still denies every other permission request. The macOS build declares why it uses the microphone input.

### Out of scope

- Song recognition (Shazam, AcoustID and MusicBrainz, search by name). It is the next change and builds on the recording added here.
- Digital transfer from the disc (MZ-RH1 style, or homebrew downloads) and Hi-MD.
- Trimming silence, splitting by gaps, and formats other than WAV (FLAC, MP3).
- Recording from a point inside a track (needs NetMD's go-to-time command, which mdconnect does not have yet).
- Monitoring the input through the computer's speakers.

## Capabilities

### New Capabilities

- `deck-recording`: recording tracks from the deck's analogue output: choosing the input, the setup and progress dialogs, how each track is started and timed, file naming and saving, cancel, and what is blocked meanwhile.

### Modified Capabilities

- `desktop-shell`: a new requirement on permissions: the renderer may capture audio and access a folder the user picks, from the app's own origin only; every other permission request stays denied. The macOS build declares its microphone use.

## Impact

- **`packages/app`:** a new `features/recording` (setup and progress dialogs, the recording session that drives the deck and the capture, WAV encoding, file naming and saving). `DiscEditor` gains the Record action and blocks other work while recording.
- **`packages/netmd`:** no change. Recording uses the existing go-to-track, play, pause, stop and status commands.
- **`apps/desktop`:** the permission handlers allow `media` (audio only) and file-system access for the app origin. `electron-builder.yml` adds `NSMicrophoneUsageDescription` for macOS.
- **`apps/web`:** no header change; the page already allows the microphone and its own scripts, which the audio worklet needs.
- **No new dependencies:** capture uses `getUserMedia` and an `AudioWorklet`, and WAV encoding is a small function in the app.
