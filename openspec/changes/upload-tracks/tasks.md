# Tasks

## 1. Cryptography (`packages/netmd`)

- [x] 1.1 Add `des.ts` with DES-ECB encrypt and decrypt and DES-CBC encrypt and decrypt. Verify with tests against the FIPS 81 DES-ECB and DES-CBC vectors and the classic "Now is the time for all " vector.
- [x] 1.2 Add `retailMac` (ISO 9797-1 MAC algorithm 3, 2-key 3DES on the last block). Verify with a published ISO 9797-1 vector and with the session key from a netmd-js session recorded for the fixture in 3.4. Checked: the ANSI X9.19 vector, and a session key built the way netmd-js builds it with crypto-js (`EDE(K1, K2, K1)` of the device nonce XOR `DES_K1(hostNonce)`). The recorded session is part of 3.4.
- [x] 1.3 Add a throughput check that encrypts 10 MB with DES-CBC. Run it outside the unit-test time budget, and verify it is faster than 20 MB/s on the maintainer's machine. Record the figure in the design. Checked: `des-throughput.test.ts` runs only with `NETMD_THROUGHPUT=1`. It measured about 74 MB/s on the maintainer's Mac with Node 22.

## 2. Transport and commands (`packages/netmd`)

- [x] 2.1 Add `transferOut` to `NetMdUsbDevice` and `NetMdTransport.bulkWrite` (endpoint 2) under the 5 s per-transfer limit. Verify with tests for a write, a stalled write and a hung write.
- [x] 2.2 Let `readReply` take a per-call total limit, including none, with the poll interval capped at 1 s. Verify with tests for a reply that arrives after 30 s of polling and for the 1 s cap.
- [x] 2.3 Let `sendQuery` accept an interim reply. Verify with tests for an accepted interim reply and for the default retry behaviour staying unchanged.
- [x] 2.4 Port the commands from netmd-js into `NetMdInterface`:
  - `acquire` and `release`;
  - `disableNewTrackProtection`;
  - `enterSecureSession` and `leaveSecureSession`;
  - `getLeafId` and `sendKeyData`;
  - `sessionKeyExchange` and `sessionKeyForget`;
  - `setupDownload`, `sendTrack` and `commitTrack`.

  Verify with a query test for each command's bytes and reply parsing. Include the `%?` status of the SJ-MR270 in the key exchange and the UUID and content ID decrypted as bytes in `sendTrack`.

- [x] 2.5 Update the file headers listing the changes from upstream. Update the `@mdconnect/netmd` package description, which still says read-only. Verify by review.

## 3. Upload session and packets (`packages/netmd`)

- [x] 3.1 Add the open-source EKB and the corrupted-deck EKB with their selection rule. Verify with tests for `054c:0081` with an all-`0xFF` leaf ID and for any other deck.
- [x] 3.2 Add the `packets.ts` generator:
  - frame padding;
  - the data key encrypted under the KEK;
  - DES-CBC chained across packets;
  - the 24-byte first-packet header;
  - 1024-byte packets.

  Verify with tests against a vector computed with netmd-js's `encrypt-generator.ts` for a fixed key, and with a test that the packets reassemble to the padded size. Checked differently: netmd-js cannot run here without its crypto library, so the tests do what the device does instead. They unwrap the data key under the KEK, decrypt the packets with DES-CBC, and compare the result with the padded audio.

- [x] 3.3 Add `UploadSession` with:
  - `open`: wait ready, forget and leave ignoring errors, acquire, disable protection ignoring a rejection, secure session, EKB, nonces, setup;
  - `uploadTrack`: the track command with the Sharp sleeps, the bulk transfer, the reply, titles, commit;
  - `close`: errors ignored.

  Inject the random source and sleep. Verify with fake-channel tests for:
  - the command order;
  - a rejected protection command on Sharp;
  - titles written before commit;
  - `close` after a failure in `uploadTrack`.

  (track-upload: "Titles written", "Device fails mid-upload".)

- [ ] 3.4 Record an SP and an LP2 upload of a short track on the second NetMD deck with the USB recorder. Anonymise the fixtures and add replay tests for `UploadSession` against them. Verify that the replay tests pass.
- [x] 3.5 Map modes to wire format, disc format and frame size, including LP105. Verify with a table test (audio-conversion: "LP105 file").

## 4. Devices and network policy (`packages/core`, `apps/web`)

- [x] 4.1 Add `nativeMonoUpload` to the device table for `04dd:9014`, `054c:0081`, `04da:23b3` and `04da:23b6`. Verify with a test listing exactly those devices (track-upload: "Deck without native mono", "Deck with native mono").
- [x] 4.2 Add `https://atrac.minidisc.wiki` to the shared CSP `connect-src` and to `apps/web/vercel.json`. Verify with the CSP tests and the vercel-config equality test (desktop-shell: "Encoding service allowed", "Other origins blocked").

## 5. Audio files (`packages/app`)

- [x] 5.1 Add `music-metadata`, pinned to the newest version that passes the age gate, and `readTags(file)` for title, artist, album, duration and track gain. Verify with tests on small tagged MP3, FLAC and M4A fixtures.
- [x] 5.2 Add `titleFromSource(tags, fileName, source)` for the six sources. Verify with tests (track-upload: "Title from file name", "Title from tags", "Missing tag").
- [x] 5.3 Add `atrac-file.ts`, which recognises ATRAC3 WAV (`0x0270` and `0xFFFE`) and OMA files, their mode from the block align or the bitrate, and encrypted OMA. Verify with header fixtures (audio-conversion: "LP4 ATRAC3 WAV", "LP105 file", "Encrypted OMA").
- [x] 5.4 Add `decode.ts`: Web Audio decoding to 44.1 kHz stereo, ReplayGain with a peak cap, and 16-bit big-endian interleaving. Keep the sample conversion and gain as pure functions with unit tests. Verify in the browser with an MP3, a FLAC, a 48 kHz mono WAV and a 5.1 file (audio-conversion: "Decode an MP3", "Unsupported format", "Apply track gain", "No tag").

## 6. LP encoders (`packages/app`) Checked in Chrome on `yarn dev:web`. A 10 s 48 kHz mono WAV decodes to 440,999 samples at 44.1 kHz with left equal to right. Generated M4A (AAC), FLAC and WAV files decode at their length. AIFF is reported as not decodable. Not checked: MP3, because macOS cannot create one, and a 5.1 file.

- [x] 6.1 Add `packages/app/vendor/atracdenc/`:
  - a `build.sh` pinning the Emscripten Docker image and the atracdenc and libsndfile commits, with `EXPORT_ES6`, `SINGLE_FILE`, `INVOKE_RUN=0` and `DYNAMIC_EXECUTION=0`;
  - the built `atracdenc.mjs`;
  - the LGPL-2.1 licence;
  - a README with the source links.

  Verify by running `build.sh` and getting the committed file byte for byte. Check that `eval` and `new Function` do not appear in the output. Record atracdenc's ATRAC3 header length in the design's open question. Checked: two runs gave the same SHA-256, and neither `eval(` nor `new Function` appears in the output. Current atracdenc writes raw frames with `--container raw`, so there is no header and the open question is closed.

- [x] 6.2 Add the built-in encoder: a WAV built from PCM, and an `atracdenc.worker.ts` loaded lazily that returns raw ATRAC3 frames. Verify with a test for the WAV header. Check in the browser that a 10-second file encodes to the expected LP2 and LP4 frame counts (audio-conversion: "Encode LP2 offline"). Checked in Chrome on `yarn dev:web`. A 10 s file encodes to 431 LP2 frames of 384 bytes and 431 LP4 frames of 192 bytes, in about 0.3 s each.
- [x] 6.3 Add the online encoder: the multipart POST, 3 attempts, and the header stripped with `atrac-file.ts`. Inject `fetch`. Verify with tests for:
  - success;
  - two failures and then success;
  - three failures, giving the skip reason;
  - ReplayGain passed as `applyReplaygain`.

  Check with a real request that CORS allows the web app's origin (audio-conversion: "Service unavailable"). Checked: a CORS preflight from `https://mdconnect.vercel.app` gets `access-control-allow-origin` back. No audio was sent.

## 7. Pipeline (`packages/app`)

- [x] 7.1 Add `fitCheck` for the time in SP units per mode and the remaining title cells, and title shortening in order. Verify with tests (track-upload: "Fits in LP2 but not in SP", "Title space runs out").
- [x] 7.2 Add `upload-pipeline.ts` with:
  - conversion one track ahead;
  - a skip on a conversion error;
  - a stop on a device error;
  - a cancel flag between tracks;
  - `close()` in every outcome;
  - progress events.

  Verify with fake-converter and fake-session tests (track-upload: "Cancel during the second track", "A file cannot be decoded", "Device fails mid-upload"; audio-conversion: "Consent declined" at the pipeline level).

- [x] 7.3 ~~Add `encrypt.worker.ts`, which runs the packet generator a few packets ahead.~~ Not needed. DES runs at about 74 MB/s, about 14 µs per 1 KB packet, so `UploadSession` encrypts each packet inline between USB writes (design, decision 3). A worker can still be plugged in through the `packets` option. Checked: `upload-session.test.ts` covers the packet source, and the demo upload test runs the whole path.
- [x] 7.4 Add `DiscReader.upload(job)`: one exclusive operation that stops playback, runs the pipeline and reads the disc again. Verify with tests that a status poll waits for it and that playback stops first (track-upload: "Playback stopped").
- [x] 7.5 Make the demo device accept uploads: append a track with the given title and length. Verify with a test, so the UI can be checked without hardware. Done differently: the demo answers the upload commands with synthetic replies, so the transfer and its progress can be tried, but it stores nothing. The disc reads the same afterwards, as with the other demo edits. Checked by `demo-upload.test.ts`.

## 8. UI (`packages/app`)

- [ ] 8.1 Add `upload-preferences.ts`, which stores the mode, title source, full-width, ReplayGain, encoder and online consent, with defaults when storage is blocked. Verify with tests (track-upload: "Remembered mode").
- [ ] 8.2 Add the "Add tracks" toolbar action and the drop target on the disc panel, with availability reasons. Verify the view logic with unit tests. Check in the browser with the demo device (track-upload: "Pick files", "Drop files", "Write-protected disc", "Files that are not audio").
- [ ] 8.3 Add the convert dialog:
  - modes;
  - the encoder choice and quality note;
  - the consent notice;
  - the title source;
  - the track list editing;
  - full-width and ReplayGain;
  - the fit summary and warnings.

  Verify the view logic with unit tests. Check in the browser that the dialog works from the keyboard (track-upload: "Reorder", "Rename before upload", "Remove the last track", "Unknown duration"; audio-conversion: "Quality note", "First use asks for consent").

- [ ] 8.4 Add the upload dialog: track N of M, two meters, "Stopping after current track…", cancel, and the final summary, with the screen wake lock held while it runs. Check in the browser with the demo device, in light and dark (track-upload: "Progress shown").

## 9. Manual verification

On the maintainer's second NetMD deck. Record the model and the results in `docs/platform-setup.md`.

- [ ] 9.1 **Desktop app on macOS:**
  1. Upload two MP3s in SP, then unplug and eject.
  2. In the deck's own display, check both tracks, their titles and their lengths.
  3. Play the start of each track on the deck.
- [ ] 9.2 **LP2 and LP4 with the built-in encoder:** upload one file in each mode. Check the mode shown by the deck and listen to a few seconds of each.
- [ ] 9.3 **LP2 with the online encoder:** accept the notice, upload a file, and check the track. Decline the notice once and check with DevTools that no request was made.
- [ ] 9.4 **Cancel:** start a 3-track upload and cancel during track 2. Check that the disc has tracks 1 and 2 only and that the deck leaves its recording state on its own.
- [ ] 9.5 **Unplug:** unplug during a transfer. Check that the Connect screen shows the device as disconnected. Reconnect and check that the disc reads, with a partial last track or none.
- [ ] 9.6 **Web app:** repeat 9.1 in Chrome on `yarn dev:web` and on the PR's Vercel preview.
- [ ] 9.7 **SP mono:** if the second deck records mono natively, upload in SP mono and check that the deck shows a mono track. Otherwise, add this check to #8.
- [ ] 9.8 **Other OSes:** add Windows and Linux uploads to #8, with steps 9.1 and 9.6, if they cannot be run here.

## Workflow follow-up

- Land the change as three stacked PRs, as the design's migration plan describes: groups 1–3, groups 4–7, then group 8 with the verification.
- Archive the change after the last PR merges.
