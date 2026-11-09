import { describe, expect, it } from 'vitest';

import { findDevice, isSupportedDevice, SUPPORTED_DEVICES, usbFilters } from './devices';

const SONY = 0x054c;

describe('SUPPORTED_DEVICES', () => {
  it('lists the 47 NetMD devices from netmd-js 4.4.1', () => {
    expect(SUPPORTED_DEVICES.filter((d) => d.kind === 'netmd')).toHaveLength(47);
  });

  it('lists the 14 Hi-MD devices from himd-js 0.2.15', () => {
    expect(SUPPORTED_DEVICES.filter((d) => d.kind === 'himd')).toHaveLength(14);
  });
});

describe('findDevice', () => {
  it('identifies an MZ-RH1 in NetMD mode', () => {
    expect(findDevice(SONY, 0x0286)).toMatchObject({ name: 'Sony MZ-RH1', kind: 'netmd' });
  });

  it('identifies an MZ-RH1 in Hi-MD mode', () => {
    expect(findDevice(SONY, 0x0287)).toMatchObject({ name: 'Sony MZ-RH1', kind: 'himd' });
  });

  it('uses the upstream display name for combined models', () => {
    expect(findDevice(SONY, 0x00c9)?.name).toBe('Sony MZ-N510/N610');
  });

  it('prefers the NetMD entry for the ID pair both upstream tables list', () => {
    expect(findDevice(SONY, 0x0187)).toMatchObject({ name: 'Sony MZ-NH600D', kind: 'netmd' });
  });

  it('returns undefined for an unknown device', () => {
    expect(findDevice(0x046d, 0xc52b)).toBeUndefined();
  });
});

describe('isSupportedDevice', () => {
  it('accepts a known MiniDisc device', () => {
    expect(isSupportedDevice(SONY, 0x00c9)).toBe(true);
  });

  it('rejects any other USB device', () => {
    expect(isSupportedDevice(0x046d, 0xc52b)).toBe(false);
  });
});

describe('usbFilters', () => {
  it('returns one filter per unique vendor/product pair (61 entries, one shared pair)', () => {
    const filters = usbFilters();
    expect(filters).toHaveLength(60);
    const keys = filters.map((f) => `${String(f.vendorId)}:${String(f.productId)}`);
    expect(new Set(keys).size).toBe(filters.length);
  });

  it('includes both NetMD and Hi-MD-mode IDs', () => {
    expect(usbFilters()).toEqual(
      expect.arrayContaining([
        { vendorId: SONY, productId: 0x0286 },
        { vendorId: SONY, productId: 0x0287 },
      ]),
    );
  });
});
