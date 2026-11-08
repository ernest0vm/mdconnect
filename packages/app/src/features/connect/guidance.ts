import type { UsbFailureKind } from '@mdconnect/core';

import type { OperatingSystem } from '../../platform';

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

/** Readable guidance for a failed connection attempt; never a raw error. */
export function guidanceFor(kind: UsbFailureKind, os: OperatingSystem): Guidance {
  switch (kind) {
    case 'no-device':
      return {
        title: 'No device found',
        message:
          'No supported MiniDisc device was found. Check the USB cable and that the device is in NetMD or Hi-MD mode.',
      };
    case 'cancelled':
      return { title: 'Cancelled', message: 'No device was chosen.' };
    case 'access-denied':
      return ACCESS_DENIED[os];
    case 'unknown':
      return { title: 'Something went wrong', message: RECONNECT };
  }
}
