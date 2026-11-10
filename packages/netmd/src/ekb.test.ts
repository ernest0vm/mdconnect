import { describe, expect, it } from 'vitest';

import { ekbForDevice } from './ekb';

const ALL_FF = new Uint8Array(8).fill(0xff);
const LEAF = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);

describe('ekbForDevice', () => {
  it('uses the open-source EKB for ordinary decks', () => {
    const ekb = ekbForDevice(LEAF, 0x054c, 0x00ca);
    expect(ekb.id).toBe(0x26422642);
    expect(ekb.chain).toHaveLength(2);
    expect(ekb.depth).toBe(9);
    expect(ekb.signature).toHaveLength(24);
    expect(ekb.rootKey).toHaveLength(16);
  });

  it('uses the corrupted-deck EKB for a JB980/JE780/NT1 whose leaf ID is all 0xFF', () => {
    const ekb = ekbForDevice(ALL_FF, 0x054c, 0x0081);
    expect(ekb.id).toBe(0x13371337);
    expect(new TextDecoder().decode(ekb.rootKey)).toBe('WMDPWMDPMiniDisc');
  });

  it('keeps the open-source EKB for a JB980 with a normal leaf ID', () => {
    expect(ekbForDevice(LEAF, 0x054c, 0x0081).id).toBe(0x26422642);
  });

  it('keeps the open-source EKB for another deck whose leaf ID is all 0xFF', () => {
    expect(ekbForDevice(ALL_FF, 0x054c, 0x00ca).id).toBe(0x26422642);
  });
});
