import type { NetMdUsbDevice } from '@mdconnect/netmd';
import type { DeviceKind, ShazamSignature, Song } from '@mdconnect/core';

/**
 * What each shell (desktop, web) provides to the shared app. The app never touches Electron or
 * browser detection directly. USB types are narrowed to what the app uses, so `navigator.usb`
 * satisfies them and tests can supply small fakes.
 */

export type PlatformKind = 'desktop' | 'web';

export type OperatingSystem = 'macos' | 'windows' | 'linux' | 'chromeos' | 'other';

/**
 * A WebUSB device as the app uses it: identity, open and close, plus the control-transfer calls
 * the NetMD protocol needs. Electron's and the browser's `USBDevice` both satisfy it.
 */
export interface UsbDeviceHandle extends NetMdUsbDevice {
  readonly vendorId: number;
  readonly productId: number;
  /** WebUSB reports a missing serial number as null. */
  readonly serialNumber?: string | null | undefined;
  open(): Promise<void>;
  close(): Promise<void>;
  /** WebUSB's reset and release, used to end a NetMD session; absent in some test doubles. */
  reset?(): Promise<void>;
  releaseInterface?(interfaceNumber: number): Promise<void>;
}

export interface UsbConnectionEventLike {
  readonly device: UsbDeviceHandle;
}

export interface PlatformUsb {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<UsbDeviceHandle>;
  getDevices(): Promise<UsbDeviceHandle[]>;
  addEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: UsbConnectionEventLike) => void,
  ): void;
  removeEventListener(
    type: 'connect' | 'disconnect',
    listener: (event: UsbConnectionEventLike) => void,
  ): void;
}

/** One device offered by the desktop main process when several supported devices are connected. */
export interface ChooserDevice {
  readonly deviceId: string;
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string | undefined;
}

export interface ChooseDeviceRequest {
  readonly requestId: string;
  readonly devices: readonly ChooserDevice[];
}

export type Unsubscribe = () => void;

export interface DeviceChooserBridge {
  onChooseDevice(callback: (request: ChooseDeviceRequest) => void): Unsubscribe;
  respond(requestId: string, deviceId: string | null): void;
}

export interface AppearanceSignals {
  /** Undefined when the platform has no signal of its own (the web). */
  readonly prefersReducedTransparency?: boolean | undefined;
}

export interface PlatformAppearance {
  get(): AppearanceSignals;
  onChange(callback: (signals: AppearanceSignals) => void): Unsubscribe;
}

/** A folder the user picked for recordings. */
export interface RecordingFolder {
  /** The folder's own name, to tell the user where files went. */
  readonly name: string;
  /**
   * Writes a file made of the parts, in order, under its name or a free variant of it; resolves
   * with the name used. A write that fails or is aborted through `signal` leaves no file.
   */
  write(fileName: string, parts: readonly Uint8Array[], signal?: AbortSignal): Promise<string>;
}

/** Song recognition calls a web page cannot make itself. */
export interface PlatformRecognition {
  /** Desktop only: asks Shazam about a signature through the main process; the song, or null. */
  readonly shazam?: ((signature: ShazamSignature) => Promise<Song | null>) | undefined;
}

export interface PlatformRecordingFolders {
  /** Asks the user for a folder; null when they cancel. */
  choose(): Promise<RecordingFolder | null>;
}

export interface Platform {
  readonly kind: PlatformKind;
  readonly os: OperatingSystem;
  readonly usb: PlatformUsb;
  /** Desktop only: the in-app chooser bridge. On the web, the browser shows its own chooser. */
  readonly deviceChooser?: DeviceChooserBridge | undefined;
  readonly appearance: PlatformAppearance;
  /** USB device kinds this shell can open: every kind on desktop, NetMD only on the web. */
  readonly deviceKinds: readonly DeviceKind[];
  /** Commit the build was made from (empty in development), for the GPL source link. */
  readonly buildCommit: string;
  /** The app version, the newest entry in CHANGELOG.md. */
  readonly version: string;
  /** Folders to save recordings in; undefined where the platform cannot write to a folder. */
  readonly recordingFolders?: PlatformRecordingFolders | undefined;
  /** Song recognition through the platform; undefined where it has nothing to add (the web). */
  readonly recognition?: PlatformRecognition | undefined;
}
