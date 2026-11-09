import { findDevice } from '@mdconnect/core';

const MASS_STORAGE_CLASS = 0x08;

/** The parts of a WebUSB device that tell Hi-MD mode apart. */
export interface HiMdModeSignals {
  readonly vendorId: number;
  readonly productId: number;
  readonly configuration?:
    | {
        readonly interfaces: readonly { readonly alternate: { readonly interfaceClass: number } }[];
      }
    | null
    | undefined;
}

/**
 * Positive evidence that a device is in Hi-MD mode: an ID that exists only in Hi-MD mode, or an
 * interface 0 that is USB mass storage (in NetMD mode it is vendor-specific). A device that merely
 * cannot be claimed is not evidence: another app or tab may hold it.
 */
export function isHiMdMode(device: HiMdModeSignals): boolean {
  if (findDevice(device.vendorId, device.productId)?.kind === 'himd') return true;
  return device.configuration?.interfaces[0]?.alternate.interfaceClass === MASS_STORAGE_CLASS;
}
