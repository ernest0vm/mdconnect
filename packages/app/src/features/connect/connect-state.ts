import { findDevice, type UsbFailureKind } from '@mdconnect/core';

export interface ConnectedDevice {
  readonly name: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string | undefined;
}

export type ConnectState =
  | { readonly status: 'idle' }
  | { readonly status: 'requesting' }
  | { readonly status: 'connected'; readonly device: ConnectedDevice }
  | { readonly status: 'failed'; readonly failure: UsbFailureKind };

export type ConnectAction =
  | { readonly type: 'request-started' }
  | { readonly type: 'connected'; readonly device: ConnectedDevice }
  | { readonly type: 'failed'; readonly failure: UsbFailureKind }
  | {
      readonly type: 'device-disconnected';
      readonly vendorId: number;
      readonly productId: number;
      readonly serialNumber?: string | undefined;
    };

export const initialConnectState: ConnectState = { status: 'idle' };

export function connectReducer(state: ConnectState, action: ConnectAction): ConnectState {
  switch (action.type) {
    case 'request-started':
      return { status: 'requesting' };
    case 'connected':
      return { status: 'connected', device: action.device };
    case 'failed':
      return { status: 'failed', failure: action.failure };
    case 'device-disconnected':
      return state.status === 'connected' && isSameDevice(state.device, action)
        ? initialConnectState
        : state;
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

function isSameDevice(a: Omit<ConnectedDevice, 'name'>, b: Omit<ConnectedDevice, 'name'>): boolean {
  return (
    a.vendorId === b.vendorId && a.productId === b.productId && a.serialNumber === b.serialNumber
  );
}
