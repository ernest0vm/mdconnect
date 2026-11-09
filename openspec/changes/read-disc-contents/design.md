# Design

## Context

- The connection layer (`ConnectionController` in `packages/app`) opens a WebUSB device and keeps it open. In both apps the device is a WebUSB `USBDevice`: Electron's on desktop, the browser's on the web. `Platform` exposes it as `UsbDeviceHandle`, which today has only `open` and `close`.
- `netmd-js` 4.4.1 (GPL-2.0, Stefano Brilli and Asivery) is the NetMD library upstream webminidisc uses. Reading a disc with it means:
  - `new NetMD(device)` and `init()`: `open`, `selectConfiguration(1)`, `claimInterface(0)`, plus loading DES/3DES WebAssembly;
  - `new NetMDInterface(netmd)`;
  - `listContent(iface)`, which issues `getDiscFlags`, `getDiscCapacity`, `getDiscTitle`, `getTrackCount`, `getTrackGroupList`, `getTrackLength` and `getTrackEncoding` (plus the title queries inside the group list) over vendor control transfers.
- Its package entry imports these modules unconditionally:
  - `@originjs/crypto-js-wasm`, resolved from GitHub (`github:asivery/crypto-js-wasm`), not from npm;
  - Node's `util`, used for log formatting;
  - `jconv` and `diacritics`, for Shift-JIS and title sanitising;
  - `jsbi` and the `buffer` polyfill.

  It ships CommonJS only. The CLI and tests also pull `usb` (native), `yargs` and `bunyan`.

- Durations are frames at 512 per second. Groups are encoded in the disc title, as in `0;Disc//1-3;Group//`.

## Goals / Non-Goals

**Goals:**

- Read and present a NetMD disc in both apps, on macOS, Windows and Linux, with no new runtime dependency.
- Keep the protocol code testable without hardware, by replaying NetMD replies recorded from a real device.

**Non-Goals:**

- Any write or transfer command, or the DES/3DES session crypto those need.
- Hi-MD mode (himd-js), playback, factory commands.

## Decisions

### 1. Port the read-only subset of netmd-js into `packages/netmd`

The new workspace `@mdconnect/netmd` (GPL-2.0-only) holds a TypeScript port of:

- the USB transport: init, `sendCommand` and `readReply` with the reply-length poll and retries;
- the query encoder and decoder (`query-utils`);
- the interface queries above;
- `listContent` and the group-title parser.

Every ported file keeps a header naming the upstream project, its authors and the version (4.4.1), and the README credits it.

- **Alternative: depend on `netmd-js` from npm.** Rejected:
  - Its entry point always loads `@originjs/crypto-js-wasm` from GitHub. Git dependencies bypass the repo's 7-day npm age gate and may run build scripts, which this repo disables.
  - It imports Node's `util`, which needs a polyfill in the web build and in the sandboxed Electron renderer.
  - It is CommonJS only.
  - Reading needs none of the crypto.
  - Tried on 2026-11-09: `yarn workspace @mdconnect/app add netmd-js@4.4.1` fails. Yarn 4.14 blocks `https://github.com/asivery/crypto-js-wasm.git` because it is not in `approvedGitRepositories`. The npm release `@originjs/crypto-js-wasm` 1.1.1 is not a drop-in replacement: the fork carries 7 commits it lacks, including "Remove dependency on `fs` from built lib", which the browser needs, and a minification-safe `mode._name`. Its license is MulanPSL-2.0, whose compatibility with GPL-2.0-only is unclear. The maintainer chose not to allow the Git dependency.
- **Alternative: `yarn patch` netmd-js to drop the crypto import.** Rejected: the GitHub dependency stays in the install graph, and the `util` and CommonJS issues remain.
- **Revisit:** when a later change adds transfers that need DES, decide again between this port plus a vetted crypto package and the upstream library. That decision belongs to that change.

`config.yaml` allows forking a protocol library into `packages/` "only when a design justifies it". The reasons above are that justification.

### 2. Transport over a minimal device interface

`packages/netmd` declares its own `NetMdUsbDevice` interface (`open`, `selectConfiguration`, `claimInterface`, `controlTransferIn`, `controlTransferOut`, `opened`) instead of depending on DOM or `w3c-web-usb` types, so it stays as platform-agnostic as `packages/core`. `UsbDeviceHandle` in `packages/app` gains the same calls, so the shells pass `navigator.usb` devices through unchanged.

### 3. Titles decode without dependencies

Both title forms are Shift-JIS, as upstream decodes them. Half-width titles can hold half-width katakana, and full-width titles hold full-width characters. Both decode with the platform's `TextDecoder('shift_jis')`, available in Chromium and Electron. Reading does not sanitise titles, so `diacritics` is not needed.

### 4. Reading lives in a disc feature in `packages/app`

- A `DiscReader` takes a connected handle and returns a `Disc` view model: the title, the groups with their tracks, and for each track its number, title, duration in seconds and mode label, plus capacity in seconds and `writeProtected`. It serialises USB access, so a Refresh never overlaps a running read.
- Upstream lists every ungrouped track before the groups (`getTrackGroupList` unshifts them). The view model rebuilds disc order instead: it walks the tracks by their global number and starts a new section whenever the group changes, so tracks 1–2 in a group and track 3 in none show as 1, 2, 3.
- The Connect screen hands over to a Disc screen once connected. The Disc screen shows:
  - the device name and USB ID line;
  - the disc panel with its title, capacity and protection;
  - the track list, grouped;
  - Refresh, and "Connect another device".
- Error mapping:
  - a command error or a timeout → "could not read the disc" with Retry;
  - an unplug during a read → the existing `device-disconnected` path, with no error shown;
  - the Hi-MD mode message only when the USB ID exists only in Hi-MD mode, or when the NetMD session cannot be opened at all (the interface cannot be selected or claimed, because in Hi-MD mode the device exposes USB mass storage instead). A failed or timed-out query, even the first one, is a read failure with Retry, never Hi-MD mode.

### 5. Tests replay recorded replies

A manual task records the request and reply bytes of one full `listContent` on the maintainer's Sony MZ-NE410/NF520D (`054c:00ca`), on a titled, grouped disc and on a blank one. A small script saves them as JSON fixtures. A fake `NetMdUsbDevice` replays them, so the transport, query decoding and `listContent` are tested byte for byte without hardware. Unit tests also cover:

- the group-title parser, including no groups, gaps and a trailing `//`;
- the frame-to-time conversion;
- the mode labels;
- the error mapping.

### 6. Desktop and web behaviour

- **Code:** identical in both apps; only the device source differs.
- **USB access:** WebUSB's control transfers to a vendor-specific interface are allowed on both. The desktop app already claims nothing else.
- **Windows:** the WinUSB driver requirement from `docs/platform-setup.md` still applies; without it, opening fails before reading starts, with the existing guidance.
- **Linux:** the udev rule still applies.
- **macOS:** another app holding the device stays the existing "device busy" path.
- **Hi-MD mode:** on the web, Hi-MD-only IDs are never offered. On the desktop, a Hi-MD-only ID gets the Hi-MD mode message without any query. The shared `054c:0187` is treated as NetMD; if it is really in Hi-MD mode, opening the NetMD session fails and the Hi-MD mode message follows.

### 7. Dependencies

None added. `packages/netmd` has no runtime dependencies; its dev dependencies match `packages/core`'s (`vite`, `vitest`, `@mdconnect/tsconfig`).

## Risks / Trade-offs

- [The port can drift from upstream fixes] → The headers pin the version (4.4.1), and the fixtures pin the behaviour. Re-diff against upstream when a later change touches the protocol.
- [Only one device model is recorded for fixtures] → Other NetMD models may reply differently (for example to the group list). The decoding follows upstream, which supports them. Hardware checks on more models go to #8.
- [Shift-JIS `TextDecoder` support differs between engines] → Chromium and Electron support it. Firefox and Safari never reach this code, because they lack WebUSB.
- [A long read on large discs] → `listContent` issues a few queries per track; at about 255 tracks this takes a few seconds. The reading state covers it.

## Migration Plan

Additive. Existing connections behave the same until the read starts. Rollback is a revert.

## Open Questions

- Whether to show track numbers starting at 1 for tracks inside groups or keep the global disc numbering. The default here is global disc numbering, as on the device's display; this can change without touching the specs.
