# Design

## Context

- **Recording path (`record-from-deck`, #33):** `features/recording` already has these pieces, which listening reuses as they are:
  - `openInput` opens the chosen input with echo cancellation, noise suppression and automatic gain off, and refuses an input that keeps them on.
  - `startCapture` streams PCM blocks from an `AudioWorklet`.
  - `recordFrames` collects a given number of frames, and rejects when the input ends or the signal aborts.
  - The session's `prime` gets the deck to the track's start, so that play starts the track at once.
  - The setup dialog lists the inputs, shows the level and remembers the input.
- **No go-to-time:** `packages/netmd` has `gotoTrack`, `play`, `pause`, `stop` and the status, but no command to start inside a track. Every listen starts at 0:00.
- **Titles:**
  - `edit-plan.ts` builds `renameTrackPlan` commands.
  - The CSV import (`csv.ts`, `reviewImport` and `importPlan`) already converts many titles at once, checks that they fit the disc, and shows the converted titles before applying them.
  - `importPlan` also rebuilds the groups from its rows and always rewrites them, so it is not used here: a group with no ticked track would have no row and would be lost.
  - `disc-titles.ts` (`titleSpaceWithStoredTitle`) checks that changed titles fit.
- **Consent:** the online encoder's consent lives in `upload-preferences.ts`. A `ConsentGuard` there keeps a withdrawal in effect across tabs, and Settings shows the consent and lets the user withdraw it.
- **Network policy:** `packages/core/src/security.ts` holds the one Content Security Policy. The desktop app sends it, and `apps/web/vercel.json` must repeat it exactly. Its `connect-src` allows only `'self'` and `https://atrac.minidisc.wiki`.
- **What the services accept**, as checked from a page origin on 2026-11-12:
  - `api.acoustid.org` and `musicbrainz.org` answer with `Access-Control-Allow-Origin: *`.
  - `amp.shazam.com` answers the CORS preflight with no allow-origin header, so a page cannot call it.
- **webminidisc:**
  - It uses `shazam-api` (GPL-2.0, by its author).
  - The input is resampled to 16 kHz mono 16-bit with ffmpeg.wasm.
  - The app listens to 12-second excerpts at 0, 12 and 24 seconds, seeking with go-to-time, and builds the title in one of five formats.
  - It reaches Shazam only through Electron's `unrestrictedFetchJSON` or a userscript.

## Goals / Non-Goals

**Goals:**

- One identification flow in `packages/app` for both apps. The only platform difference is whether a Shazam client exists.
- Reuse the recording capture and deck priming unchanged, and the title conversion and fit check that renaming and the CSV import use.
- Service clients that take an injected `fetch` and are unit-tested against recorded responses, with no network in tests.

**Non-Goals:**

- Matching quality beyond what each service gives.
- Caching results between sessions, or recognising a track from a recorded WAV file.

## Decisions

### 1. One session, three identifiers

`identifyTracks(tracks, options)` reuses the recording session's structure:

- It stops the deck, and for each track it primes the track, plays it and captures it.
- The deck is stopped in a `finally`, and the progress, cancel and disconnect handling are those of `recordTracks`.

What differs per method is an `Identifier`:

```ts
interface Identifier {
  /** Seconds of audio to capture before each attempt, and how many attempts. */
  readonly plan: (
    trackSeconds: number,
  ) => { excerptSeconds: number; attempts: number } | 'too-short';
  identify(
    pcm: PcmBuffer,
    sampleRate: number,
    trackSeconds: number,
    signal: AbortSignal,
  ): Promise<Song | null>;
}
```

- Shazam's plan is 12 seconds, with as many attempts as whole 12-second excerpts fit in the track, at most three. A 20-second track gets one, so an excerpt never runs into the next track.
- AcoustID's plan is `min(120, trackSeconds)` seconds, one attempt.
- Search by name has no session: the dialog calls the MusicBrainz client directly.

Alternative considered: a separate session per method. It would copy the deck and cancel handling that the recording session already gets right.

**Keeping playback continuous:** for several attempts, the next excerpt's `recordFrames` starts as soon as the previous one resolves, and the identify call for the previous excerpt runs at the same time. The capture keeps the blocks in order, so seconds 12 to 24 follow 0 to 12 with no gap, and a match stops both. This stands in for webminidisc's go-to-time seeks, which `packages/netmd` cannot do.

### 2. Shazam signature ported into `packages/core`; the request goes through the desktop main process

**The signature:**

- `packages/core/src/recognition/shazam-signature.ts` ports `SignatureGenerator` and its encoder from `shazam-api` 0.3.0, with the upstream attribution and GPL-2.0 header. The encoder is the binary layout with a CRC32 and base64.
- It takes 16 kHz mono 16-bit samples and returns the encoded signature URI and the sample length.
- The FFT (2048-point real) is a small radix-2 implementation in the same folder, instead of `fft.js`.

Why a port instead of the package:

- `shazam-api` depends on `node-fetch` and `buffer`, which would need polyfills in the page.
- Its request code impersonates the iPhone app and is not wanted in the page at all.
- The generator is about 300 lines of arithmetic, like the NetMD code already ported into `packages/netmd`.

**Resampling** to 16 kHz mono uses an `OfflineAudioContext` in `packages/app`, a platform API. ffmpeg.wasm is not needed.

**The request:**

- The preload exposes `recognition.shazam({ uri, sampleMs })`.
- The main process sends it with Electron's `net.fetch` to `https://amp.shazam.com/discovery/v5/en/US/android/-/tag/<uuid>/<uuid>`, with the body and headers `shazam-api` uses.
- It returns `{ title, artist, album, year } | null`, read from the track's `title`, `subtitle` and its metadata section.
- **Cancel:** the page's Shazam client races the bridge call against the session's `AbortSignal`. On abort it rejects at once and ignores a late reply, so the session reaches its `finally` and stops the deck without waiting for Shazam. The main process gives each request a 15-second timeout.

The main process checks the request before sending it:

- the call comes from the app's origin, like the recording handlers;
- `uri` is a `data:audio/vnd.shazam.sig;base64,` signature whose decoded header has the right magic numbers;
- `sampleMs` is at most 15,000.

Because nothing else is accepted, the bridge cannot be used to reach any other endpoint or to send arbitrary data.

**The web app:** the platform's `recognition.shazam` is `undefined`, and the dialog marks Shazam unavailable from that.

Alternatives considered:

- A Vercel function as a proxy. The user chose desktop only. A proxy would route users' signatures through our server, and Shazam could block Vercel's addresses.
- webminidisc's userscript route, which is out of scope.

### 3. AcoustID fingerprints with `@unimusic/chromaprint`, loaded on demand

**Why this package:** AcoustID matches fingerprints computed by Chromaprint's own algorithm and its default settings. `@unimusic/chromaprint` 0.1.4 is Chromaprint's own C++ sources (a git submodule of acoustid/chromaprint) compiled to WebAssembly with Emscripten (ES module, `ENVIRONMENT=web`), so its fingerprints are those `fpcalc` gives.

**How it is used:**

- Its `processAudioFile(buffer)` is not used: it decodes the file with a new `AudioContext` that it never closes, so each track would leave a context open, and the app already has the PCM.
- Instead, the app imports the package's Emscripten module (`@unimusic/chromaprint/dist/chromaprint.js`, typed by its `chromaprint.d.ts`) and calls Chromaprint's C API on the captured 16-bit samples: `chromaprint_new`, `start(sampleRate, channels)`, `feed`, `finish`, `get_fingerprint`, then `free` for the context and every buffer it allocated, in a `finally`.
- The module is loaded with a dynamic `import()` only when AcoustID is chosen, and instantiated once. Its WebAssembly is fetched from the app's origin, which `script-src 'wasm-unsafe-eval'` already allows in both apps.
- It sits behind a `Fingerprinter` interface (`(pcm: Int16Array, sampleRate: number, channels: number) => Promise<string>`), so tests use a fake and the package can be replaced.

**The lookup:**

- `POST https://api.acoustid.org/v2/lookup`, form-encoded, with these fields:
  - `client`: the app's key;
  - `duration`: the track's length from the disc, in whole seconds;
  - `fingerprint`;
  - `meta=recordings releasegroups compress`.
- The result with the highest score is taken when it scores at least 0.5. From it, the first recording gives:
  - the title;
  - the artists, joined by their `joinphrase`;
  - the album: its first release group of type Album, else its first release group.

Alternatives considered:

| Option                                                         | Why not                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `rusty-chromaprint-wasm` 0.1.5 (MIT, a Rust re-implementation) | Its fingerprints are not guaranteed to match Chromaprint's bit for bit; published 2026-03, no other users.          |
| `chromaprint-web` 1.0.2                                        | Published as UNLICENSED, so it cannot be distributed under GPL-2.0.                                                 |
| Porting Chromaprint to TypeScript                              | Its resampler, FFT, chroma filters, classifiers and compression would all have to stay bit-exact with the database. |
| Running `fpcalc` in the main process                           | Desktop only, and it would add a native binary per OS to the packages.                                              |

**The AcoustID client key:**

- It is registered by the maintainer at acoustid.org as the application "mdconnect".
- It is stored in `packages/core/src/recognition/services.ts`. Client keys identify the application and are public in open-source clients such as MusicBrainz Picard.
- AcoustID's free use is for non-commercial applications, which mdconnect is.

### 4. MusicBrainz search from the page

- **Request:** `GET https://musicbrainz.org/ws/2/recording?query=<text>&limit=10&fmt=json`. The text is escaped for MusicBrainz's Lucene syntax.
- **Each result shows:**
  - the title;
  - the artist credit;
  - the first release's title and the first release date's year;
  - the length.
- **Rate limit:** MusicBrainz allows one request a second per client. Searches run only when the user presses Search, and the client waits until a second has passed since its last request.
- **Identifying the app:** MusicBrainz asks clients to identify themselves in the User-Agent, which a page cannot set.
  - In the desktop app, the main process adds `mdconnect/<version> ( https://github.com/ernest0vm/mdconnect )` to requests for `musicbrainz.org` and `api.acoustid.org` with `session.webRequest.onBeforeSendHeaders`.
  - The web app sends the browser's own User-Agent, which MusicBrainz accepts for browser applications.

### 5. Consent per service, stored like the encoder's

- `recognition-preferences.ts` stores these preferences under one key with the existing preference storage:
  - the method;
  - the title format;
  - `consent: { shazam, acoustid, musicbrainz }`.
- It reuses the `ConsentGuard` pattern, so a withdrawal in one tab is not undone by another.
- The dialog asks for a service's consent before the first track is played, or before the first search. Settings gains the Song recognition section with one withdraw action per service.

### 6. Results and applying them

**Results:**

- Each track's result is one of:
  - `{ kind: 'found', song }`;
  - `{ kind: 'not-found' }`;
  - `{ kind: 'too-short' }`;
  - `{ kind: 'unreachable' }`;
  - `{ kind: 'none' }` (not tried yet, or cancelled).
- `formatTitle(song, format)` builds the raw title. It joins only the parts that are present, with " - ".
- An edited title replaces the formatted one for that track.

**Applying** uses a title-only plan:

- Each ticked track with a title is converted with `sanitizeHalfWidthTitle` and `sanitizeFullWidthTitle` and becomes `setTrackTitle` commands only for the titles that change. No group command is emitted, so groups and the other titles stay as they are.
- Unlike `renameTrackPlan`, which leaves the full-width title alone when none is given, the full-width title is always decided, as in webminidisc: with full-width titles on, it is `sanitizeFullWidthTitle(raw)` unless `sanitizeHalfWidthTitle` of that result equals the half-width title, in which case it is empty; with them off, it is empty. So "Dawn" gets no full-width title (its full-width form "Ｄａｗｎ" converts back to "Dawn"), "夜明け" keeps one, and a track's old full-width title is cleared, since the disc view shows a full-width title before the half-width one.
- The fit is checked with the disc-title space helpers on the disc with the new titles.
- The dialog shows the converted titles and whether they fit, and Apply runs the plan through the reader's edit queue.

### 7. Blocking other work

- The recording change blocks controls with a `recording` flag and the `RECORDING_IN_PROGRESS` reason.
- This change replaces the flag with a `deckBusy: 'recording' | 'identifying' | null` value. Each reason then names what is running.
- `recordBlocker`, `editBlocker`, `addTracksBlocker`, `playerBlocker` and the new `identifyBlocker` read it.
- Search by name does not set it, because it does not use the deck.

### Desktop and web

|                   | Desktop app                                                   | Web app                      |
| ----------------- | ------------------------------------------------------------- | ---------------------------- |
| Shazam            | Through the main process                                      | Unavailable, with the reason |
| AcoustID          | From the page; User-Agent set by the main process             | From the page                |
| Search by name    | From the page; User-Agent set by the main process             | From the page                |
| CSP `connect-src` | Adds `https://api.acoustid.org` and `https://musicbrainz.org` | The same, in `vercel.json`   |

There is no USB, file-system or packaging change. On macOS, Windows and Linux, `net.fetch` uses the system's proxy settings, and the capture behaves as in the recording change.

### New dependency

| Package                       | Purpose                                               | License                                                                                                  | Maintenance                                                                         |
| ----------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `@unimusic/chromaprint` 0.1.4 | Chromaprint fingerprints for AcoustID, in WebAssembly | MIT wrapper, with Chromaprint (LGPL-2.1+) and KissFFT (BSD-3-Clause) inside, all compatible with GPL-2.0 | One maintainer, last release 2025-07-11, no runtime dependencies, no install script |

`shazam-api` is not a dependency: its generator is ported, as decision 2 explains.

## Risks / Trade-offs

- **[Shazam's API is unofficial and impersonates its app]** It can change or block clients at any time, and using it may break Shazam's terms.
  - The consent notice says it is unofficial.
  - Failures show "The service could not be reached" instead of an error.
  - The request code is in one main-process function that can be fixed or removed alone.
- **[Fingerprints of analogue audio]** AcoustID matches less reliably than Shazam on audio that went through the deck's DAC and the computer's input, and on discs recorded from the radio. The spec's 0.5 score threshold keeps weak matches out. Shazam remains the better choice in the desktop app.
- **[AcoustID needs up to two minutes per track]** A 20-track disc takes about 40 minutes to identify. The dialog says how long it will take before it starts, and Cancel keeps the results found so far.
- **[`@unimusic/chromaprint` has one maintainer]**
  - It is pinned, and used only behind `Fingerprinter`.
  - A test compares its fingerprint of a committed synthetic WAV with `fpcalc`'s output, so a broken upgrade fails.
  - Its build script is public, so the WebAssembly can be vendored if the package is abandoned.
- **[A track that starts with silence or a long intro]**
  - Shazam's three excerpts cover only the first 36 seconds.
  - Search by name stays available for those tracks.
- **[MusicBrainz rate limit]** A user searching quickly may be throttled; the client spaces requests a second apart, and a 503 counts as unreachable after one retry.
- **[The key and the services in the CSP]** Adding two origins widens what page code could reach. Both are read-only lookup services, and the spec's "What recognition sends" requirement limits what is sent.

## Migration Plan

- No stored data changes. The new preferences start empty, so each service asks for consent on first use.
- Rollback is a revert. The added CSP origins and the Shazam bridge go with it.
- Order: archive `record-from-deck` before archiving this change, because both add requirements to `desktop-shell`.
