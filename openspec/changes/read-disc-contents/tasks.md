# Tasks

## 1. Workspace and fixtures

- [ ] 1.1 Create `packages/netmd` (`@mdconnect/netmd`, GPL-2.0-only), following the conventions of the other workspaces: the `lint`, `format:check`, `typecheck` and `test` scripts, and a dev dependency on `@mdconnect/tsconfig`. Add the upstream attribution (netmd-js 4.4.1, Stefano Brilli and Asivery, GPL-2.0) to a package README and to the root README credits. `yarn check:affected` passes, including the repo-policy tests.
- [ ] 1.2 Manual, with the maintainer's Sony MZ-NE410/NF520D (`054c:00ca`):
  - Record the control-transfer requests and replies of one full disc read, using a scratch script on the desktop app over CDP that logs every `controlTransferIn` and `controlTransferOut`.
  - Record three cases: a disc with a title, groups and at least one Japanese title if available; a blank disc; and no disc.
  - Save them as JSON fixtures under `packages/netmd/test/fixtures/`, with the device model and the date.

## 2. Protocol port (packages/netmd)

- [ ] 2.1 Tests first, then port the query encoder and decoder from `query-utils` (format and scan of bytes, words, double words, quad words and BCD). Test against hand-written vectors from upstream's behaviour.
- [ ] 2.2 Tests first, then port the transport (`init`, `sendCommand` and `readReply`, with the reply-length poll, retries and timeout) over the `NetMdUsbDevice` interface. Test with a fake device that replays the 1.2 fixtures (disc-contents: "Command fails").
- [ ] 2.3 Tests first, then port the read queries (`getStatus`, `getDiscFlags`, `getDiscCapacity`, `getDiscTitle` for half and full width, `getTrackCount`, `getTrackLength`, `getTrackEncoding`, `getTrackTitle`) and the group-title parser, including no groups, gaps and a trailing `//`. Decode Shift-JIS with `TextDecoder` (disc-contents: "Grouped disc", "Japanese titles").
- [ ] 2.4 Tests first, then port `listContent` so that it returns, from each fixture: the titled disc with its groups, tracks, durations in frames, encodings, capacity and write protection; the blank disc; and the "no disc" status (disc-contents: "Disc read on connect", "Capacity", "Write-protected disc", "Blank disc", "No disc inserted").

## 3. App integration (packages/app)

- [ ] 3.1 Extend `UsbDeviceHandle` and the test fakes with `selectConfiguration`, `claimInterface`, `controlTransferIn`, `controlTransferOut` and `opened`. Check that the desktop and web shells still type-check, passing their devices unchanged.
- [ ] 3.2 Tests first for the `Disc` view model:
  - frames to minutes and seconds;
  - mode labels (SP, LP2, LP4, mono);
  - the "Untitled" placeholder;
  - global track numbering across groups;
  - capacity in SP terms.

  (disc-contents: "Untitled track", "Capacity")

- [ ] 3.3 Tests first for `DiscReader`. It serialises reads, so a Refresh during a read waits instead of overlapping. It maps errors: a command error or timeout → "could not read" with Retry; an unplug → no error; no reply to NetMD → the Hi-MD mode message (disc-contents: "Command fails", "Unplugged while reading", "Device in Hi-MD mode", "Refresh after changing discs").
- [ ] 3.4 Disc screen: the device line; the disc title, capacity and write-protected badge; the grouped track list; the reading, no-disc, error and Hi-MD states; and the Refresh, Retry and "Connect another device" actions. The connect flow hands over to it after `connected` and returns to the Connect screen on unplug. Keep every control keyboard-operable, and keep text at 4.5:1 contrast or more in light and dark.

## 4. Verification (manual)

- [ ] 4.1 Desktop, macOS, with the MZ-NE410/NF520D:
  - Connect with each fixture disc: the screen matches what the device's own display shows (titles, groups, track count and times).
  - Swap discs and Refresh.
  - Eject the disc and Refresh: the "no disc" state.
  - Unplug while reading: the Connect screen returns.

  (disc-contents: all scenarios except "Device in Hi-MD mode")

- [ ] 4.2 Web, Chrome on macOS: the same checks as 4.1 on `yarn dev:web` and on the Vercel preview of the PR.
- [ ] 4.3 Keyboard and contrast: Tab reaches Refresh, the track list and "Connect another device", and the focus ring is visible on each. Measure contrast in light and dark on a long, grouped disc.
- [ ] 4.4 Record the tested model, OS and browser in `docs/platform-setup.md` ("Verified hardware"). Add a Hi-MD-mode check (MZ-NH600 or a desktop Hi-MD device) and other NetMD models to #8.

## Workflow follow-up

- Archive with `/opsx:archive` after the verification above is done.
