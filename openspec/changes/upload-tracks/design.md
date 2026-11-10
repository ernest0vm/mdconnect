# Design

## Context

- `packages/netmd` is a dependency-free port of the read and edit parts of netmd-js 4.4.1.
  - `NetMdTransport` sends control transfers only.
  - Each USB step fails after 5 s (PR #17), and `readReply` gives up after 10 s in total.
  - `NetMdInterface.sendQuery` retries an interim reply four times and then fails.
  - There is no bulk transfer and no cryptography.
- `DiscReader` (`packages/app`) is the device's single queue. Reads, edits, playback commands and status polls all wait their turn on it.
- Titles already have converters and space accounting:
  - `sanitize.ts` converts half-width and full-width titles;
  - `remainingTitleSpace` in `disc-titles.ts` counts the title cells left;
  - `setTrackTitle` writes a title.
- **Shared CSP:** `packages/core/src/security.ts` defines `connect-src 'self'` and allows `'wasm-unsafe-eval'`. `apps/web/vercel.json` repeats the policy, and a test keeps the two equal. The web app is cross-origin isolated (COEP `require-corp`).
- **Desktop scheme:** the app is served from `app://`, registered as standard, secure and fetch-capable.
- **Upstream references:**
  - netmd-js `netmd-interface.ts` (`MDSession`, `sendTrack`, `setupDownload`, `commitTrack`, `retailmac`);
  - `netmd-ekb.ts`;
  - `encrypt-generator.ts`;
  - `netmd-commands.ts` (`prepareDownload`);
  - webminidisc `src/services/interfaces/netmd.ts` (`prepareUpload`, `upload`, `finalizeUpload`);
  - `src/redux/actions.ts` (`convertAndUpload`);
  - `src/utils.ts` (ATRAC WAV and OMA parsing);
  - `encoders/atracdenc` and `encoders/remote-encoder`.

## Goals / Non-Goals

**Goals:**

- Keep `packages/netmd` platform-agnostic and dependency-free. Cryptography, the protocol and packet framing are pure TypeScript that can be tested with fakes.
- Close the device's upload session in every outcome. Upstream leaks it when a conversion fails.
- Keep at most two tracks of decoded audio in memory: the one transferring and the next one converting.
- Make the encoder origin the only new network destination, and use it only after consent.

**Non-Goals:**

- Faster SP uploads through exploits.
- Uploading to Hi-MD.
- Resuming an interrupted upload.
- Choosing ATRAC3 bitrates other than LP2 and LP4.

## Decisions

### 1. Pure-TypeScript DES in `packages/netmd`

**What is needed:**

- DES-ECB (encrypt and decrypt);
- DES-CBC (encrypt for the audio, decrypt for the track reply);
- the ISO 9797-1 retail MAC (single DES chained, last block with 2-key 3DES) for the session key.

**Implementation:**

- `des.ts` implements FIPS 46-3 with precomputed SP-boxes, working on 32-bit halves.
- `des.test.ts` checks it against:
  - the FIPS 81 / NBS DES-ECB and DES-CBC vectors;
  - an ISO 9797-1 MAC algorithm 3 vector;
  - one recorded session from netmd-js, for the session key and the setup payload.

**Alternatives:**

- **`@originjs/crypto-js-wasm`**, which netmd-js uses. Rejected:
  - its MulanPSL-2.0 licence has unclear GPL-2.0 compatibility;
  - it is a GitHub fork, not on npm;
  - it needs wasm loading.
- **`des.js` (MIT).** Rejected: a new dependency with CommonJS-only builds, for about 200 lines of code.
- **Web Crypto.** It has no DES at all.

**Throughput:** an SP minute is about 10.6 MB. A table-driven JS DES runs well above the deck's transfer speed, and encryption runs in a worker ahead of the transfer (see 3). Measured: about 74 MB/s for DES-CBC in 1024-byte packets (Node 22, the maintainer's Mac; `des-throughput.test.ts`).

### 2. Protocol: an `UploadSession` and transport extensions

**Transport and device interface:**

- `NetMdUsbDevice` gains `transferOut(endpointNumber, data)`. WebUSB's `USBDevice` in Chromium and in Electron both provide it.
- `NetMdTransport.bulkWrite(data)` writes to endpoint 2. Each write keeps the 5 s per-transfer limit, so a hung device still fails.
- `readReply({ timeoutMs })` accepts a per-call limit, with the poll interval capped at 1 s. The reply after a track's bulk transfer may take up to five minutes, because the deck answers once it has written the audio. Upstream has no limit, but a deck stuck in its recording state (as the MZ-NE410 got stuck in #8) would then keep the upload waiting forever. Each poll still has its 5 s USB limit, and an unplug ends it.
- `sendQuery(query, { acceptInterim: true })` returns the first interim reply. `sendTrack` needs this.

**New `NetMdInterface` commands** (byte layouts as in netmd-js `netmd-interface.ts`, all under the `1800 080046 f0030103` prefix):

- `acquire`, `release`;
- `disableNewTrackProtection`;
- `enterSecureSession`, `leaveSecureSession`;
- `getLeafId`, `sendKeyData`;
- `sessionKeyExchange`, `sessionKeyForget`;
- `setupDownload`, `sendTrack`, `commitTrack`.

**`upload-session.ts`** owns the sequence. It is a port of netmd-js `prepareDownload` and `MDSession`.

1. **`open()`:**
   - wait for the deck to be ready;
   - forget any old key and leave any old session, ignoring errors;
   - acquire;
   - disable new-track protection, ignoring a rejection (Sharp);
   - enter the secure session, send the EKB and exchange nonces;
   - derive the session key and send the setup.
2. **`uploadTrack(track, onProgress)`:**
   - take the track's audio and mode, and build its packets with the mode's frame size, so the frame count, the announced length and the packets always agree;
   - send the track command, wait 200 ms on either side as upstream does for Sharp, then the bulk transfer;
   - read the reply and decrypt the UUID and content ID, keeping them as bytes rather than upstream's lossy text;
   - write the half-width title and, when it differs, the full-width title;
   - commit, and return the new track number.
3. **`close()`:**
   - forget the key, leave the session and release, each ignoring errors;
   - always called from a `finally`.

**Session details:**

- **EKB:** the open-source EKB by default. The "corrupted deck" EKB is used for `054c:0081` when the 8-byte leaf ID is all `0xFF`.
- **Host nonce:** comes from an injected random source, `globalThis.crypto.getRandomValues` in the app. Upstream uses `Math.random`.

### 3. Packet encryption in a worker

`packets.ts` in `packages/netmd` is a pure generator, a port of `encrypt-generator.ts`:

- pad the audio to whole frames, copying only the last chunk;
- generate a random 8-byte data key;
- send the key encrypted under the fixed KEK;
- encrypt the data with DES-CBC from a zero IV, chained across packets;
- prefix the first packet with the 24-byte header (`00000000`, size, key, IV).

Packets are 1024 bytes, as in webminidisc. That value is proven across many decks. The 1 MiB netmd-js default is not.

`UploadSession` takes a `packets` option, `(data, frameSize) => AsyncIterable<packet>`, which defaults to running the generator on the calling thread. In `packages/app`, that option is backed by `encrypt.worker.ts`, which runs the generator. It posts packets back with transferable buffers and stays at most a few packets ahead, so memory stays flat. The main thread awaits `bulkWrite` for each packet and reports two numbers: bytes encrypted (the "buffer" value) and bytes written.

### 4. Formats

| Mode    | Wire format | Disc format | Frame size | Source                  |
| ------- | ----------- | ----------- | ---------- | ----------------------- |
| SP      | `0x00`      | `0x06`      | 2048 B     | PCM                     |
| SP mono | `0x00`      | `0x04`      | 2048 B     | PCM; the deck downmixes |
| LP2     | `0x94`      | `0x02`      | 192 B      | encoder or ATRAC3 file  |
| LP105   | `0x90`      | `0x02`      | 152 B      | ATRAC3 file only        |
| LP4     | `0xa8`      | `0x00`      | 96 B       | encoder or ATRAC3 file  |

LP105 files are sent with their own wire format. Upstream sends any non-LP4 ATRAC3 file as LP2, which is wrong for 105 kbps.

**Native mono:** `packages/core`'s device table gains `nativeMonoUpload: true`, matching netmd-js's flags:

- Sharp IM-DR80 (`04dd:9014`);
- Sony MDS-JB980/NT1/JE780 (`054c:0081`);
- Panasonic SJ-MR250 (`04da:23b3`) and SJ-MR270 (`04da:23b6`).

### 5. Decoding with Web Audio

`decode.ts` turns a file into PCM:

1. Read the file's bytes, then decode them with `decodeAudioData` on an `OfflineAudioContext` at 44.1 kHz.
2. Render the result through a 2-channel `OfflineAudioContext` at 44.1 kHz. That applies the Web Audio up-mix and down-mix rules, so mono, stereo and 5.1 are all handled.
3. Apply the ReplayGain factor, `10^(gain/20)`, capped so the peak stays at or below full scale.
4. Convert to interleaved 16-bit big-endian samples.

**Codec support:**

- **Chromium and Electron:** MP3, AAC/M4A, FLAC, WAV, Ogg Vorbis and Opus. Electron's Chromium ships the proprietary codecs.
- **Linux:** some distro Chromium builds lack AAC. The file is then reported as not decodable.

**Alternative:** ffmpeg.wasm, which webminidisc uses. Rejected by the maintainer:

- a 4 MB custom GPL core plus a worker;
- the only gain is rare formats.

### 6. LP encoders

Both encoders implement `encode(source, mode) → ATRAC3 frames`.

**Built-in (atracdenc):**

- Input is a 44.1 kHz 16-bit little-endian stereo WAV built from the decoded PCM.
- A worker runs `atracdenc -e atrac3 --bitrate 128|64`, as webminidisc does, and strips the output header to keep the raw frames.
- We build atracdenc ourselves (dcherednik/atracdenc, LGPL-2.1, plus libsndfile, LGPL-2.1) with a pinned Emscripten Docker image, using:
  - `MODULARIZE`, `EXPORT_ES6` and `SINGLE_FILE`;
  - `INVOKE_RUN=0`;
  - `DYNAMIC_EXECUTION=0`, so the output never calls `eval` or `new Function`, which the CSP forbids.
- The output `atracdenc.mjs` (about 1 MB) is committed under `packages/app/vendor/atracdenc/` together with:
  - the licence;
  - the upstream commits;
  - `build.sh`, to satisfy the LGPL's source requirement.
- It is loaded lazily, only when LP is chosen.

Alternative: commit webminidisc's prebuilt `atracdenc.js`. Rejected: it was built with an old Emscripten and closure flags we cannot audit or reproduce.

**Online (Sony encoder through atrac-api):**

- `POST https://atrac.minidisc.wiki/transcode?type=LP2|LP4`, with `&applyReplaygain=true` when ReplayGain is on.
- The body is multipart `file` with the original file bytes.
- It is tried up to 3 times, and the ATRAC WAV header is stripped from the response with the parser from 7.
- Consent is stored with the other upload preferences. The notice names the service and says that the audio files are sent to it.
- The request is a CORS `fetch`, which COEP allows when the service answers with `Access-Control-Allow-Origin`. webminidisc calls it from browsers, so it does.
- The origin is added to the shared CSP `connect-src` and to `vercel.json`. The CSP equality test keeps them in step.

### 7. Pre-encoded ATRAC3

`atrac-file.ts` is a port of webminidisc's `getATRACWAVEncoding` and OMA parsing:

- RIFF/WAVE with format `0x0270`, or `0xFFFE` with the ATRAC3 subformat;
- the block align selects the mode: 384 is LP2, 304 is LP105, 192 is LP4;
- for OMA (`EA3`), the codec ID and bitrate params are read and an encryption flag rejects the file.

### 8. Tags with `music-metadata`

`parseBlob` gives title, artist, album, duration and `replaygain_track_gain`. The duration feeds the fit check without decoding. When it is missing, the dialog decodes the file to measure it.

**Dependency:** `music-metadata`.

- MIT licence, maintained by Borewit with frequent releases.
- ESM, with browser support through `parseBlob`.
- Pulls in `strtok3`, `token-types` and `file-type` (all MIT).

The newest version older than 7 days is pinned at apply time.

**Alternative:** hand-written ID3, Vorbis-comment and MP4 tag readers. Rejected: about 1000 lines to get wrong.

### 9. Pipeline and the device queue

`upload-pipeline.ts` is pure orchestration with injected converters, session and clock. It is tested with fakes.

- **Queue:** `DiscReader.upload(job)` runs as one exclusive operation, so status polls and edits wait. It stops playback first. After the session closes, it reads the disc again.
- **One track ahead:** an async generator converts track N+1 while track N transfers.
- **Errors:**
  - a conversion error records a skipped track and continues;
  - a device error stops the upload, records the remaining tracks as not uploaded, and goes on to `close()`.
- **Cancel:** a flag checked between tracks.
- **Titles:** shortened, in order, to the remaining title cells, as webminidisc does, with full-width titles capped at 105 characters.
- **Unplug:** shows as a transfer error. `ConnectionController` already switches to the Connect screen, and `close()` fails silently.

### 10. UI

**Entry points:**

- An "Add tracks" action in the disc toolbar opens a hidden `<input type="file" multiple accept="audio/*,.oma,.at3">`.
- Native `dragover` and `drop` handlers on the disc panel show a drop overlay. There is no `react-dropzone`.

**Convert dialog** (`GlassDialog`, wide):

- a mode segmented control;
- an encoder choice when LP is selected (Built-in, or Sony online, with its notice);
- a title-source select;
- the track list with move up, move down, remove and rename;
- "Add more";
- full-width and ReplayGain checkboxes;
- the fit summary and warnings;
- Upload.

**Upload dialog:**

- It cannot be dismissed while running. Escape and the close button ask to cancel.
- Two `GlassMeter` bars show conversion and transfer.
- It ends with a summary of uploaded, skipped and not-uploaded tracks.

**Preferences:**

- `upload-preferences.ts` stores the mode, title source, full-width, ReplayGain, encoder and online consent in `localStorage`, following `appearance-store.ts`.
- A blocked profile falls back to the defaults.

**Wake lock:** `navigator.wakeLock.request('screen')` while uploading, ignored where it is missing. The Chromium and Electron renderers both support it.

### 11. Platforms

**Desktop and web:**

- Everything runs in the renderer with web APIs: WebUSB bulk transfers, Web Audio, Workers, `fetch` and the wake lock. Both apps behave the same.
- Workers load from `app://` in the desktop app; the scheme is standard and fetch-capable. A smoke test is a manual task.

**Each OS:**

- **macOS:** no driver.
- **Windows:** the WinUSB (Zadig) driver needed for control transfers also covers bulk endpoint 2, so there is no new setup.
- **Linux:** the existing udev rule grants the whole device, bulk endpoints included.
- **File picking and drop:** the same on all three.

## Risks / Trade-offs

- **The MZ-NE410 does not keep changes on the disc (#8).** Hardware checks run on the maintainer's second NetMD deck. Protocol tests replay recorded USB fixtures.
- **Long files use a lot of memory.** A 60-minute single file decodes to about 1.2 GB of floats. If decoding fails, the file is reported as not decodable. The note in the dialog suggests splitting very long files.
- **The online service is a third party.** It can change or disappear, and the audio leaves the machine. Mitigations: explicit consent, the built-in encoder as the default, and clear failure reasons.
- **The atracdenc build needs Docker and Emscripten.** The build script pins the image, and the committed output means contributors do not need to rebuild it.
- **Pure-JS DES speed.** It runs in a worker ahead of the USB writes, and a benchmark test guards it, outside the unit-test time budget.
- **Upstream-proven 1024-byte packets may be slow.** That value is kept for compatibility; tuning is left to later.
- **Size of the change.** See the migration plan.

## Migration Plan

This change lands as three stacked PRs, one per task group cluster, each passing `check:affected`:

1. the protocol and cryptography in `packages/netmd`;
2. conversion, encoders and the pipeline in `packages/app`;
3. the UI, CSP and preferences.

Nothing is persisted that needs migrating. Rolling back removes the "Add tracks" action and the CSP entry.

## Open Questions

- The exact header length atracdenc writes for `atrac3` output. Webminidisc strips 96 bytes; this is confirmed when the build is made.
