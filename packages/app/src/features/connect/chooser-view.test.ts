import { describe, expect, it } from 'vitest';

import type { ChooserDevice } from '../../platform';
import { chooserView } from './chooser-view';

const device = (deviceId: string, productId: number, serialNumber?: string): ChooserDevice => ({
  deviceId,
  name: productId === 0x0286 ? 'Sony MZ-RH1' : 'Sony MZ-N510/N610',
  vendorId: 0x054c,
  productId,
  serialNumber,
});

describe('chooserView (usb-device-access: "Several devices of the same model")', () => {
  it('lists different models by name and USB ID without a hint', () => {
    const view = chooserView([device('a', 0x00c9), device('b', 0x0286)]);
    expect(view.entries).toEqual([
      { deviceId: 'a', title: 'Sony MZ-N510/N610', detail: '054c:00c9' },
      { deviceId: 'b', title: 'Sony MZ-RH1', detail: '054c:0286' },
    ]);
    expect(view.showUnplugHint).toBe(false);
  });

  it('shows distinct serial numbers instead of numbering', () => {
    const view = chooserView([device('a', 0x00c9, 'S1'), device('b', 0x00c9, 'S2')]);
    expect(view.entries.map((e) => e.title)).toEqual(['Sony MZ-N510/N610', 'Sony MZ-N510/N610']);
    expect(view.entries.map((e) => e.detail)).toEqual([
      '054c:00c9 · serial S1',
      '054c:00c9 · serial S2',
    ]);
    expect(view.showUnplugHint).toBe(false);
  });

  it('numbers identical devices without serial numbers in list order and shows the hint', () => {
    const view = chooserView([device('a', 0x00c9), device('x', 0x0286), device('b', 0x00c9)]);
    expect(view.entries.map((e) => e.title)).toEqual([
      'Sony MZ-N510/N610 #1',
      'Sony MZ-RH1',
      'Sony MZ-N510/N610 #2',
    ]);
    expect(view.showUnplugHint).toBe(true);
  });

  it('treats identical serial numbers like missing ones', () => {
    const view = chooserView([device('a', 0x00c9, 'S1'), device('b', 0x00c9, 'S1')]);
    expect(view.entries.map((e) => e.title)).toEqual([
      'Sony MZ-N510/N610 #1',
      'Sony MZ-N510/N610 #2',
    ]);
    expect(view.showUnplugHint).toBe(true);
  });
});
