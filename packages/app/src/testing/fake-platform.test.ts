import { describe, expect, it } from 'vitest';

import { createFakePlatform, fakeDevice } from './fake-platform';

describe('createFakePlatform', () => {
  it('defaults to a desktop platform on macOS with no devices', async () => {
    const { platform } = createFakePlatform();
    expect(platform.kind).toBe('desktop');
    expect(platform.os).toBe('macos');
    expect(await platform.usb.getDevices()).toEqual([]);
  });

  it('records requestDevice filters and returns the queued result', async () => {
    const device = fakeDevice(0x054c, 0x00c9);
    const { platform, usb } = createFakePlatform();
    usb.nextRequest = () => Promise.resolve(device);
    const filters = [{ vendorId: 0x054c, productId: 0x00c9 }];

    await expect(platform.usb.requestDevice({ filters })).resolves.toBe(device);
    expect(usb.requestedFilters).toEqual([filters]);
  });

  it('delivers connect and disconnect events to listeners until they unsubscribe', () => {
    const { platform, usb } = createFakePlatform();
    const seen: string[] = [];
    const listener = () => seen.push('connect');
    platform.usb.addEventListener('connect', listener);
    usb.emit('connect', fakeDevice(0x054c, 0x00c9));
    platform.usb.removeEventListener('connect', listener);
    usb.emit('connect', fakeDevice(0x054c, 0x00c9));
    expect(seen).toEqual(['connect']);
  });
});
