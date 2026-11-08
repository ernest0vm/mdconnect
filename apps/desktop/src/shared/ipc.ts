/** IPC channels between the main process and the preload bridge. Payloads are plain data. */
export const IPC = {
  chooseDevice: 'usb:choose-device',
  deviceChosen: 'usb:device-chosen',
  appearanceChanged: 'appearance:changed',
  appearanceGet: 'appearance:get',
} as const;

export interface ChooserDevicePayload {
  readonly deviceId: string;
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string | undefined;
}

export interface ChooseDeviceRequestPayload {
  readonly requestId: string;
  readonly devices: readonly ChooserDevicePayload[];
}

export interface DeviceChosenPayload {
  readonly requestId: string;
  readonly deviceId: string | null;
}

export interface AppearancePayload {
  readonly prefersReducedTransparency: boolean;
}

export type DesktopOs = 'macos' | 'windows' | 'linux';

export function desktopOsFrom(platform: string): DesktopOs {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}
