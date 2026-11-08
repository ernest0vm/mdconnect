import { describe, expect, it } from 'vitest';

import {
  connectReducer,
  describeDevice,
  formatUsbId,
  initialConnectState,
  type ConnectState,
} from './connect-state';

const mzN510 = describeDevice({ vendorId: 0x054c, productId: 0x00c9, serialNumber: 'A1' });

describe('formatUsbId', () => {
  it('formats vendor and product as lowercase four-digit hex', () => {
    expect(formatUsbId(0x054c, 0x00c9)).toBe('054c:00c9');
  });
});

describe('describeDevice', () => {
  it('names a supported device from the table', () => {
    expect(mzN510).toEqual({
      name: 'Sony MZ-N510/N610',
      vendorId: 0x054c,
      productId: 0x00c9,
      serialNumber: 'A1',
    });
  });

  it('returns undefined for an unsupported device', () => {
    expect(describeDevice({ vendorId: 0x046d, productId: 0xc52b })).toBeUndefined();
  });
});

describe('connectReducer', () => {
  const connected: ConnectState = mzN510
    ? { status: 'connected', device: mzN510 }
    : initialConnectState;

  it('starts idle', () => {
    expect(initialConnectState).toEqual({ status: 'idle' });
  });

  it('moves to requesting when a request starts', () => {
    expect(connectReducer(initialConnectState, { type: 'request-started' })).toEqual({
      status: 'requesting',
    });
  });

  it('shows the connected device', () => {
    expect(connected).toMatchObject({ status: 'connected' });
    expect(
      mzN510 && connectReducer({ status: 'requesting' }, { type: 'connected', device: mzN510 }),
    ).toEqual(connected);
  });

  it.each(['no-device', 'cancelled', 'access-denied', 'unknown'] as const)(
    'records a %s failure',
    (failure) => {
      expect(connectReducer({ status: 'requesting' }, { type: 'failed', failure })).toEqual({
        status: 'failed',
        failure,
      });
    },
  );

  it('returns to idle when the connected device is unplugged', () => {
    const next = connectReducer(connected, {
      type: 'device-disconnected',
      vendorId: 0x054c,
      productId: 0x00c9,
      serialNumber: 'A1',
    });
    expect(next).toEqual({ status: 'idle' });
  });

  it('ignores the unplugging of a different device', () => {
    const next = connectReducer(connected, {
      type: 'device-disconnected',
      vendorId: 0x054c,
      productId: 0x00c9,
      serialNumber: 'B2',
    });
    expect(next).toBe(connected);
  });
});
