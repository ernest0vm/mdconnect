import { describe, expect, it } from 'vitest';

import { isHiMdMode } from './hi-md-mode';

const device = (productId: number, interfaceClass?: number) => ({
  vendorId: 0x054c,
  productId,
  configuration:
    interfaceClass === undefined ? undefined : { interfaces: [{ alternate: { interfaceClass } }] },
});

describe('isHiMdMode (disc-contents: "Device in Hi-MD mode")', () => {
  it('is true for an ID that exists only in Hi-MD mode', () => {
    expect(isHiMdMode(device(0x0287))).toBe(true);
  });

  it('is true when interface 0 is USB mass storage, as in Hi-MD mode, even on a shared NetMD ID', () => {
    expect(isHiMdMode(device(0x0187, 0x08))).toBe(true);
  });

  it('is false for a NetMD ID with a vendor-specific interface or no configuration yet', () => {
    expect(isHiMdMode(device(0x0187, 0xff))).toBe(false);
    expect(isHiMdMode(device(0x00ca))).toBe(false);
  });
});
