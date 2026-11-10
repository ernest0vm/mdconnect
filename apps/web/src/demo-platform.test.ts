import type { Platform, PlatformUsb } from '@mdconnect/app';
import { describe, expect, it } from 'vitest';

import { demoRequested, withDemoDevice } from './demo-platform';

describe('demoRequested', () => {
  it('is on only when the URL has ?demo', () => {
    expect(demoRequested('?demo')).toBe(true);
    expect(demoRequested('?x=1&demo=1')).toBe(true);
    expect(demoRequested('')).toBe(false);
    expect(demoRequested('?demonstration')).toBe(false);
  });
});

describe('withDemoDevice', () => {
  // Like navigator.usb, the methods live on the prototype, so spreading the object loses them.
  class PrototypeUsb implements PlatformUsb {
    listeners = 0;
    requestDevice() {
      return Promise.reject(new Error('real chooser'));
    }
    getDevices() {
      return Promise.resolve([]);
    }
    addEventListener() {
      this.listeners += 1;
    }
    removeEventListener() {
      this.listeners -= 1;
    }
  }
  const usb = new PrototypeUsb();
  const platform = { kind: 'web', usb } as unknown as Platform;

  it('answers the chooser with an MZ-NE410 that reads the recorded disc', async () => {
    const device = await withDemoDevice(platform).usb.requestDevice({ filters: [] });
    expect([device.vendorId, device.productId]).toEqual([0x054c, 0x00ca]);
    await device.open();
    expect(device.opened).toBe(true);
  });

  it('keeps the real connect and disconnect listeners', () => {
    const demo = withDemoDevice(platform).usb;
    demo.addEventListener('connect', () => undefined);
    expect(usb.listeners).toBe(1);
    demo.removeEventListener('connect', () => undefined);
    expect(usb.listeners).toBe(0);
  });
});
