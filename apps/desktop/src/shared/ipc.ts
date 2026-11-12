/** IPC channels between the main process and the preload bridge. Payloads are plain data. */
export const IPC = {
  chooseDevice: 'usb:choose-device',
  deviceChosen: 'usb:device-chosen',
  appearanceChanged: 'appearance:changed',
  appearanceGet: 'appearance:get',
  recordingsChooseFolder: 'recordings:choose-folder',
  recordingsWrite: 'recordings:write',
} as const;

/** A folder the user picked for recordings: an opaque id and the folder's own name, never a path. */
export interface RecordingFolderPayload {
  readonly id: string;
  readonly name: string;
}

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

/** Maps `process.platform` to the OS names the app uses; any other Unix is treated as Linux. */
export function desktopOsFrom(platform: string): DesktopOs {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}
