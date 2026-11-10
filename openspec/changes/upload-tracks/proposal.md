## Why

mdconnect can read, edit and play a disc, but it cannot record onto it, which is the main reason people use webminidisc. Uploading audio files to a NetMD device is the largest feature still missing for webminidisc parity.

## What Changes

- **Add tracks:** pick audio files, or drop them on the disc panel, to open a convert dialog. The dialog lists the tracks and lets the user reorder, remove and rename them. It also sets:
  - the recording mode: SP, SP mono on decks that support it natively, LP2 or LP4;
  - where titles come from (file name or tags);
  - full-width titles;
  - ReplayGain.

  It shows whether the tracks fit on the disc and in its title space, and refuses an upload that does not fit.

- **Audio conversion** runs inside the app:
  - files are decoded with the platform's Web Audio decoder;
  - SP is sent as 44.1 kHz 16-bit stereo PCM, which the deck encodes;
  - LP2 and LP4 are encoded to ATRAC3 by a bundled atracdenc build;
  - the user can instead choose Sony's encoder through the online ATRAC service used by webminidisc, after a notice that the audio leaves the computer;
  - ATRAC3 WAV and unencrypted OMA files at LP2, LP105 or LP4 are uploaded without re-encoding.
- **NetMD upload protocol** in `packages/netmd`:
  - the secure session: EKB, nonce exchange, session key, setup;
  - an encrypted bulk transfer of each track;
  - titles written for each track, then a commit;
  - a pure-TypeScript DES/3DES, because Web Crypto has none.
- **Upload progress:**
  - conversion runs one track ahead of the transfer;
  - each step has its own progress bar;
  - cancelling stops after the current track;
  - the app keeps the screen awake while uploading;
  - playback stops first;
  - the session is always closed when the upload ends, fails or is cancelled;
  - tracks already written are kept;
  - the disc is read again at the end.
- **Network access:** the Content Security Policy that both apps share allows one more destination, the ATRAC encoding service, and nothing else.

### Out of scope

- Hi-MD uploads, and NetMD homebrew features that need device exploits: SP mono on decks without native support, and uploading ATRAC1 (`.aea`) files.
- Downloading tracks from the disc to the computer.
- ffmpeg.wasm and the formats only it decodes, such as AIFF and WMA. A file the platform cannot decode is reported and skipped.
- A local music library, and "add from library".
- Gapless upload, which NetMD ignores.
- Desktop notifications when an upload finishes.
- Settings for other encoders, or a configurable encoder address.

## Capabilities

### New Capabilities

- `track-upload`: adding audio files to a NetMD disc. Covers:
  - the convert dialog and its options;
  - the capacity and title-space checks;
  - progress, cancel and errors during an upload;
  - the guarantees for the disc and the session.
- `audio-conversion`: turning a user's audio file into data a NetMD deck accepts. Covers:
  - decoding;
  - the SP PCM format;
  - LP2 and LP4 encoding with the bundled and the online encoders;
  - ReplayGain;
  - passing pre-encoded ATRAC3 through.

### Modified Capabilities

- `desktop-shell`: a new requirement limits the UI's network destinations to the app origin and the ATRAC encoding service. The web app shares this policy through `web-delivery`'s existing "same Content Security Policy" requirement, so `web-delivery` needs no delta.

## Impact

- **`packages/netmd`:**
  - `NetMdUsbDevice` gains `transferOut` (bulk OUT, endpoint 2);
  - the transport accepts a longer wait for the reply that follows a bulk transfer;
  - `sendQuery` can accept an interim reply;
  - new modules for DES, the EKB, the secure session and the packet encryptor.
- **`packages/app`:**
  - the convert dialog, upload progress dialog and the drop target on the disc panel;
  - decoding, encoding and the upload pipeline;
  - an encryption worker and an atracdenc worker.
- **`packages/core`:**
  - the shared CSP gains the encoder origin in `connect-src`;
  - the device table marks the decks that record SP mono natively.
- **`apps/web`:** `vercel.json` repeats the updated CSP.
- **New runtime dependency:** `music-metadata`, to read tags for titles and ReplayGain.
- **New bundled asset:** `atracdenc.js`, an Emscripten build of atracdenc (LGPL-2.1), about 1 MB, with its source and build steps documented.
- **Hardware:** the MZ-NE410 does not keep changes on the disc (see #8). Uploads are verified on the maintainer's second NetMD deck.
