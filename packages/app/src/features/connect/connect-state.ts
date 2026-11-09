import { findDevice, type UsbFailureKind } from '@mdconnect/core';

export interface ConnectedDevice {
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string | undefined;
}

/**
 * The connected device and the last failure are tracked separately: a failed attempt to switch to
 * another device keeps the previous one (still open) visible next to the failure message.
 */
export interface ConnectState {
  readonly device: ConnectedDevice | null;
  readonly requesting: boolean;
  readonly failure: UsbFailureKind | null;
}

export type ConnectAction =
  | { readonly type: 'request-started' }
  | { readonly type: 'connected'; readonly device: ConnectedDevice }
  | { readonly type: 'failed'; readonly failure: UsbFailureKind }
  /** Dispatched only when the open device itself is unplugged. */
  | { readonly type: 'device-disconnected' };

export const initialConnectState: ConnectState = { device: null, requesting: false, failure: null };

export function connectReducer(state: ConnectState, action: ConnectAction): ConnectState {
  switch (action.type) {
    case 'request-started':
      return { ...state, requesting: true, failure: null };
    case 'connected':
      return { device: action.device, requesting: false, failure: null };
    case 'failed':
      return { ...state, requesting: false, failure: action.failure };
    case 'device-disconnected':
      return initialConnectState;
  }
}

/** Formats USB IDs the way device lists show them, for example `054c:00c9`. */
export function formatUsbId(vendorId: number, productId: number): string {
  const hex = (value: number) => value.toString(16).padStart(4, '0');
  return `${hex(vendorId)}:${hex(productId)}`;
}

/** Names a USB device from the supported table, or returns undefined when it is not a MiniDisc. */
export function describeDevice(handle: {
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string | null | undefined;
}): ConnectedDevice | undefined {
  const entry = findDevice(handle.vendorId, handle.productId);
  if (entry === undefined) return undefined;
  return {
    name: entry.name,
    vendorId: handle.vendorId,
    productId: handle.productId,
    serialNumber: handle.serialNumber ?? undefined,
  };
}
