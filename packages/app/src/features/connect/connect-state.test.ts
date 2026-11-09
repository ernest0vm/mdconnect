import { describe, expect, it } from 'vitest';

import {
  connectReducer,
  describeDevice,
  formatUsbId,
  initialConnectState,
  type ConnectedDevice,
  type ConnectState,
} from './connect-state';

function supported(vendorId: number, productId: number, serialNumber?: string): ConnectedDevice {
  const device = describeDevice({ vendorId, productId, serialNumber });
  if (device === undefined) throw new Error('fixture device is not in the supported table');
  return device;
}

const mzN510 = supported(0x054c, 0x00c9, 'A1');
const mzRh1 = supported(0x054c, 0x0286);
const connected: ConnectState = { ...initialConnectState, device: mzN510 };

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

  it('normalises the empty serial number Chrome reports for serial-less devices to undefined', () => {
    expect(
      describeDevice({ vendorId: 0x054c, productId: 0x00ca, serialNumber: '' })?.serialNumber,
    ).toBeUndefined();
  });

  it('normalises a null serial number to undefined', () => {
    expect(
      describeDevice({ vendorId: 0x054c, productId: 0x0286, serialNumber: null })?.serialNumber,
    ).toBeUndefined();
  });

  it('returns undefined for an unsupported device', () => {
    expect(describeDevice({ vendorId: 0x046d, productId: 0xc52b })).toBeUndefined();
  });
});

describe('connectReducer', () => {
  it('starts with no device, no request and no failure', () => {
    expect(initialConnectState).toEqual({
      device: null,
      requesting: false,
      failure: null,
      unplugged: null,
    });
  });

  it('marks a request in progress and clears the previous failure', () => {
    const failed: ConnectState = { ...initialConnectState, failure: 'no-device' };
    expect(connectReducer(failed, { type: 'request-started' })).toEqual({
      device: null,
      requesting: true,
      failure: null,
      unplugged: null,
    });
  });

  it('keeps showing the connected device while another request runs', () => {
    expect(connectReducer(connected, { type: 'request-started' }).device).toBe(mzN510);
  });

  it('shows the newly connected device', () => {
    const requesting = connectReducer(connected, { type: 'request-started' });
    expect(connectReducer(requesting, { type: 'connected', device: mzRh1 })).toEqual({
      device: mzRh1,
      requesting: false,
      failure: null,
      unplugged: null,
    });
  });

  it.each(['no-device', 'cancelled', 'access-denied', 'unknown'] as const)(
    'records a %s failure',
    (failure) => {
      const requesting: ConnectState = { ...initialConnectState, requesting: true };
      expect(connectReducer(requesting, { type: 'failed', failure })).toEqual({
        device: null,
        requesting: false,
        failure,
        unplugged: null,
      });
    },
  );

  it('keeps the previous device visible when switching to another one fails', () => {
    const requesting = connectReducer(connected, { type: 'request-started' });
    expect(connectReducer(requesting, { type: 'failed', failure: 'access-denied' })).toEqual({
      device: mzN510,
      requesting: false,
      failure: 'access-denied',
      unplugged: null,
    });
  });

  it('clears the device when a device is unplugged, remembering the one the action names', () => {
    expect(connectReducer(connected, { type: 'device-disconnected', device: mzRh1 })).toEqual({
      ...initialConnectState,
      unplugged: mzRh1,
    });
  });

  it('forgets the unplugged device once a device connects again', () => {
    const unplugged = connectReducer(connected, { type: 'device-disconnected', device: mzN510 });
    const requesting = connectReducer(unplugged, { type: 'request-started' });
    expect(requesting.unplugged).toBe(mzN510);
    expect(connectReducer(requesting, { type: 'connected', device: mzN510 }).unplugged).toBeNull();
  });
});
