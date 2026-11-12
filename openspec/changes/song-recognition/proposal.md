# Proposal

## Why

Many MiniDiscs were recorded from CDs or the radio and never titled, so their tracks show as "Track 1", "Track 2". Typing the titles by hand is slow on a disc of 20 tracks. webminidisc offers "Song Recognition", which listens to each track through the deck's output and names it with Shazam. Now that mdconnect records from the deck, the same audio path can identify tracks too. Like Windows Media Player's "Find album info", users also want to look a song up by its name and pick the right match when it cannot be recognised by ear.

## What Changes

- **Identify:** a new action in the track toolbar, next to Record, opens a dialog for the selected tracks. The user picks one of three ways to find each track's song, and the dialog shows each track's current title next to the title found.
- **Shazam (desktop app only):** the deck plays each track from its start. The app listens to 12 seconds and sends a Shazam signature of that audio. If there is no match, it tries the next 12 seconds, up to three times. The web app shows this option as unavailable, with the reason: Shazam's service refuses requests from web pages.
- **AcoustID and MusicBrainz:** the deck plays each track from its start. The app listens to up to two minutes and computes a Chromaprint fingerprint. It sends the fingerprint and the track's length to AcoustID, which returns the matching MusicBrainz recordings. This works in both apps.
- **Search by name:** no audio is involved. For each track the user types a title, an artist or both, which start from the track's current title. The app searches MusicBrainz and the user picks the right recording from a list showing title, artist, album, year and length.
- **Reviewing and applying:**
  - The user chooses how the new title is built: Title; Artist - Title; Title - Artist; Album - Title; or Artist - Album - Title. The choice is remembered.
  - The user can edit any new title and leave out any track.
  - Apply new titles writes the titles to the disc. They go through the same title conversion and title-space check as renaming a track.
- **Consent:** the first time each service is used, the app says what is sent to it and to whom, and goes ahead only after the user confirms.
  - Shazam receives a signature of 12-second excerpts.
  - AcoustID receives a fingerprint and the track length.
  - MusicBrainz receives the search text.
  - The consent can be withdrawn in Settings.
  - No audio itself is ever sent.
- **While listening:** a progress dialog shows the track being identified and a Cancel button. Editing, uploads, recording and the player controls are unavailable until it ends, and the deck is stopped when it ends.

### Out of scope

- Identifying tracks from a downloaded copy of the audio (webminidisc's "Exploits" method, which needs homebrew firmware access mdconnect does not have).
- Starting playback at a point inside a track, which would need NetMD's go-to-time command. Listening continues from the track's start instead.
- Shazam in the web app, through a proxy, a userscript or any other route.
- Writing tags into recorded WAV files, cover art, and renaming the disc or groups from the results.
- Submitting fingerprints to AcoustID or editing MusicBrainz data.
- Other lookup services (Discogs, Deezer, Apple's iTunes Search, CDDB).

## Capabilities

### New Capabilities

- `song-recognition`: identifying the songs on a disc and turning them into track titles. It covers the Identify action and dialog, the three methods (Shazam, AcoustID and MusicBrainz, search by name), how each track is listened to, title formats, reviewing and applying the titles, consent for each service, cancel, and what is blocked meanwhile.

### Modified Capabilities

- `desktop-shell`: Network destinations adds AcoustID and MusicBrainz to the origins the UI may reach. A new requirement lets the main process send Shazam requests on the page's behalf, to Shazam's recognition endpoint only.
- `audio-conversion`: "No audio leaves the computer otherwise" also allows what the user agreed to send to the recognition services. That is fingerprints, signatures, track lengths and search text, never audio.
- `app-settings`: the Settings dialog shows the consent given to each recognition service and lets the user withdraw it.

## Impact

- **`packages/core`:** a port of the Shazam signature generator from `shazam-api` (GPL-2.0, by webminidisc's author), with its FFT, plus the recognition origins in the shared Content Security Policy.
- **`packages/app`:** a new `features/recognition`:
  - the Identify dialog and its progress dialog;
  - the session that drives the deck and the capture;
  - the Shazam, AcoustID and MusicBrainz clients, built on an injected `fetch`;
  - title formatting.
    The existing recording capture (`openInput`, `startCapture`, `recordFrames`, the priming of a track) is reused, and `DiscPanel` gains the Identify action.
- **`apps/desktop`:** the preload gains `recognition.shazam(signature)`, backed by the main process with Electron's `net.fetch`, which sends only to Shazam's endpoint and only a valid signature.
- **`apps/web`:** the platform provides no Shazam client. `vercel.json`'s Content Security Policy adds `https://api.acoustid.org` and `https://musicbrainz.org`.
- **New dependency:** `@unimusic/chromaprint` (MIT wrapper around Chromaprint, LGPL-2.1, compiled to WebAssembly), loaded only when AcoustID is used. The design explains why it is used instead of porting Chromaprint.
- **AcoustID client key:** the maintainer registers mdconnect as an application at acoustid.org. The key is public, as in other open-source clients.
- **Depends on `record-from-deck`**, merged in #33, for the capture. That change should be archived before this one.
