# Proposal

## Why

mdconnect connects to a NetMD device but shows only its name and USB IDs. Reading what is on the inserted MiniDisc is the first feature that makes the app useful. Every later feature (renaming, recording, transfers) builds on it. It also replaces the guesswork around the shared `054c:0187` ID: talking NetMD to the device tells whether it really is in NetMD mode.

## What Changes

- After a NetMD device connects, the app reads the disc and shows:
  - the disc title;
  - the tracks, organised in their groups, each with number, title, duration and recording mode (SP, LP2, LP4, mono);
  - the used, free and total time;
  - whether the disc is write-protected.
- A **Refresh** action reads the disc again, for example after changing discs.
- Clear states for "no disc inserted", "reading…", a failed read, and a device that does not answer NetMD (for example a Hi-MD device in Hi-MD mode).
- A new workspace `packages/netmd`: a TypeScript port of the read-only part of `netmd-js` 4.4.1 (GPL-2.0, by Stefano Brilli and Asivery). It covers the USB transport and the queries needed to list a disc, and has no runtime dependencies. See design.md for why it is a port rather than a dependency.
- `UsbDeviceHandle` (the device handle in `Platform`) gains the WebUSB calls the transport needs: `selectConfiguration`, `claimInterface`, `controlTransferIn` and `controlTransferOut`.
- Same behaviour in the desktop app and the web app.

Out of scope:

- Writing anything to the disc: titles, groups, erasing, moving tracks.
- Recording or transferring audio, in either direction, and the encryption it needs.
- Reading Hi-MD discs in Hi-MD mode (himd-js); such devices get a clear "not supported yet" state.
- Playback controls and device status polling while playing.
- Factory-mode and TOC-editing commands.

## Capabilities

### New Capabilities

- `disc-contents`: reading and presenting the contents and capacity of the disc in a connected NetMD device, including its loading, empty and error states.

### Modified Capabilities

None. `usb-device-access` keeps owning connection, and the new capability starts once a device is connected.

## Impact

- New workspace `packages/netmd` (GPL-2.0-only, upstream attribution in file headers and in the README credits).
- `packages/app`: the extended device handle, a disc feature (read service and screen), and test doubles that replay recorded NetMD replies.
- `apps/desktop`, `apps/web`: no code changes expected. The browser and Electron `USBDevice` already provide the added calls.
- No new runtime dependencies.
