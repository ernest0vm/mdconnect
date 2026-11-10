import type { Platform, UsbDeviceHandle } from '@mdconnect/app';
import { DEMO_PRODUCT_ID, DEMO_VENDOR_ID, demoDevice } from '@mdconnect/netmd/demo';

/** The demo device is for `yarn dev:web` only, and only when the URL asks for it with `?demo`. */
export function demoRequested({ dev, search }: { dev: boolean; search: string }): boolean {
  return dev && new URLSearchParams(search).has('demo');
}

/**
 * The browser platform with the chooser answered by a demo MZ-NE410 that replays a recorded disc.
 * Edits are rejected, as the recording holds no replies for them.
 */
export function withDemoDevice(platform: Platform): Platform {
  const device = demoDevice();
  const handle: UsbDeviceHandle = {
    vendorId: DEMO_VENDOR_ID,
    productId: DEMO_PRODUCT_ID,
    serialNumber: 'demo',
    get opened() {
      return device.opened;
    },
    open: () => device.open(),
    close: () => Promise.resolve(),
    selectConfiguration: (value) => device.selectConfiguration(value),
    claimInterface: (number) => device.claimInterface(number),
    controlTransferIn: (setup, length) => device.controlTransferIn(setup, length),
    controlTransferOut: (setup, data) => device.controlTransferOut(setup, data),
  };
  return {
    ...platform,
    usb: {
      requestDevice: () => Promise.resolve(handle),
      getDevices: () => Promise.resolve([]),
      // navigator.usb keeps its methods on the prototype: call them, do not spread them.
      addEventListener: (type, listener) => {
        platform.usb.addEventListener(type, listener);
      },
      removeEventListener: (type, listener) => {
        platform.usb.removeEventListener(type, listener);
      },
    },
  };
}
