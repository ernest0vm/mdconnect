import type { DeviceKind, UsbFailureKind } from '@mdconnect/core';

import type { OperatingSystem, PlatformKind } from '../../platform';

/** Community setup guide that upstream webminidisc also points to. */
const SETUP_GUIDE_URL = 'https://www.minidisc.wiki/guides/webminidisc/requirements';
export const WINDOWS_SETUP_URL = `${SETUP_GUIDE_URL}#windows`;
export const LINUX_SETUP_URL = `${SETUP_GUIDE_URL}#linux`;

export interface Guidance {
  readonly title: string;
  readonly message: string;
  readonly link?: { readonly label: string; readonly href: string };
}

const RECONNECT = 'Unplug the device, reconnect it and try again.';

const ACCESS_DENIED: Record<OperatingSystem, Guidance> = {
  windows: {
    title: 'Driver needed',
    message:
      'Windows needs a USB driver for this device before mdconnect can open it. Install it once, then reconnect the device.',
    link: { label: 'Windows setup steps', href: WINDOWS_SETUP_URL },
  },
  linux: {
    title: 'Permission needed',
    message:
      'Your user does not have permission to open this device. Install the mdconnect udev rule, then reconnect the device.',
    link: { label: 'Linux setup steps', href: LINUX_SETUP_URL },
  },
  macos: {
    title: 'Device busy',
    message: `Close other apps that may be using the device, then reconnect it.`,
  },
  chromeos: { title: 'Could not open the device', message: RECONNECT },
  other: { title: 'Could not open the device', message: RECONNECT },
};

const NO_DEVICE = 'No supported MiniDisc device was found.';

/** What the failed attempt offered: which chooser the user saw and which device kinds it listed. */
export interface GuidanceContext {
  readonly platformKind: PlatformKind;
  readonly deviceKinds: readonly DeviceKind[];
}

const offersHimd = (deviceKinds: readonly DeviceKind[]) => deviceKinds.includes('himd');

/** The connect screen's prompt, naming only the device kinds this platform offers. */
export function connectPrompt(deviceKinds: readonly DeviceKind[]): string {
  return offersHimd(deviceKinds)
    ? 'Plug in a NetMD or Hi-MD device over USB, then connect to it.'
    : 'Plug in a NetMD device (or a Hi-MD device in NetMD mode) over USB, then connect to it.';
}

function noDeviceMessage({ platformKind, deviceKinds }: GuidanceContext): string {
  const cable =
    platformKind === 'web'
      ? "Check the USB cable, and pick the device in the browser's list."
      : 'Check the USB cable.';
  const mode = offersHimd(deviceKinds)
    ? 'Make sure the device is in NetMD or Hi-MD mode.'
    : 'mdconnect does not support Hi-MD mode yet; switch the device to NetMD mode if it offers one.';
  return `${NO_DEVICE} ${cable} ${mode}`;
}

/**
 * Readable guidance for a failed connection attempt; never a raw error. The `no-device` message
 * names the chooser the user saw and only the device kinds the platform offered.
 */
export function guidanceFor(
  kind: UsbFailureKind,
  os: OperatingSystem,
  context: GuidanceContext,
): Guidance {
  switch (kind) {
    case 'no-device':
      return { title: 'No device found', message: noDeviceMessage(context) };
    case 'cancelled':
      return { title: 'Cancelled', message: 'No device was chosen.' };
    case 'access-denied':
      return ACCESS_DENIED[os];
    case 'unknown':
      return { title: 'Something went wrong', message: RECONNECT };
  }
}
