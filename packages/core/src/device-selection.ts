import { isSupportedDevice } from './devices';

/** A USB device as a chooser sees it (for example Electron's `select-usb-device` list). */
export interface CandidateDevice {
  readonly deviceId: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string;
}

export type DeviceChoice =
  | { readonly kind: 'none' }
  | { readonly kind: 'auto'; readonly deviceId: string }
  | { readonly kind: 'ask'; readonly devices: readonly CandidateDevice[] };

/** Picks the device without prompting when exactly one supported device is present. */
export function chooseDevice(devices: readonly CandidateDevice[]): DeviceChoice {
  const supported = devices.filter((d) => isSupportedDevice(d.vendorId, d.productId));
  const [only] = supported;
  if (only === undefined) return { kind: 'none' };
  if (supported.length === 1) return { kind: 'auto', deviceId: only.deviceId };
  return { kind: 'ask', devices: supported };
}
