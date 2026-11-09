import { describe, expect, it } from 'vitest';

import { chooseDevice, type CandidateDevice } from './device-selection';

const mzN510: CandidateDevice = { deviceId: 'a', vendorId: 0x054c, productId: 0x00c9 };
const mzRh1: CandidateDevice = { deviceId: 'b', vendorId: 0x054c, productId: 0x0286 };
const keyboard: CandidateDevice = { deviceId: 'k', vendorId: 0x046d, productId: 0xc52b };

describe('chooseDevice', () => {
  it('reports none when nothing is connected', () => {
    expect(chooseDevice([])).toEqual({ kind: 'none' });
  });

  it('selects the only supported device automatically', () => {
    expect(chooseDevice([mzN510])).toEqual({ kind: 'auto', deviceId: 'a' });
  });

  it('asks the user when several supported devices are connected', () => {
    expect(chooseDevice([mzN510, mzRh1])).toEqual({ kind: 'ask', devices: [mzN510, mzRh1] });
  });

  it('ignores unsupported devices', () => {
    expect(chooseDevice([keyboard])).toEqual({ kind: 'none' });
    expect(chooseDevice([keyboard, mzRh1])).toEqual({ kind: 'auto', deviceId: 'b' });
  });
});
