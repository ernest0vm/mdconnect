import type { Session } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import { ChooserBridge } from './chooser-bridge';
import { installUsbHandlers } from './usb';

vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }));

type CheckHandler = (contents: unknown, permission: string, requestingOrigin: string) => boolean;
type DeviceHandler = (details: {
  deviceType: string;
  origin: string;
  device: Record<string, unknown>;
}) => boolean;

/** Installs the handlers on a fake Session and returns what was registered. */
function install() {
  let check: CheckHandler = () => false;
  let device: DeviceHandler = () => false;
  const session = {
    setPermissionCheckHandler: (handler: CheckHandler) => {
      check = handler;
    },
    setDevicePermissionHandler: (handler: DeviceHandler) => {
      device = handler;
    },
    on: vi.fn(),
  };
  installUsbHandlers(session as unknown as Session, new ChooserBridge(() => true), {
    packaged: true,
    devServerUrl: undefined,
  });
  return {
    check: (...args: Parameters<CheckHandler>) => check(...args),
    device: (d: Parameters<DeviceHandler>[0]) => device(d),
  };
}

const MZ_NE410 = { vendorId: 0x054c, productId: 0x00ca, usbVersionMajor: 1 };

describe('installUsbHandlers (usb-device-access: "Connect screen")', () => {
  it('grants the usb permission check for the app origin as Electron passes it, with a trailing slash', () => {
    // Without this, Electron never emits select-usb-device and every Connect fails.
    expect(install().check(null, 'usb', 'app://mdconnect/')).toBe(true);
  });

  it('denies other permissions and other origins', () => {
    const { check } = install();
    expect(check(null, 'hid', 'app://mdconnect/')).toBe(false);
    expect(check(null, 'usb', 'https://evil.example/')).toBe(false);
    expect(check(null, 'usb', 'app://mdconnect//')).toBe(false);
    expect(check(null, 'usb', 'app://mdconnect.evil/')).toBe(false);
  });

  it('grants supported devices to the app origin as the device handler receives it', () => {
    const { device } = install();
    expect(device({ deviceType: 'usb', origin: 'app://mdconnect', device: MZ_NE410 })).toBe(true);
    expect(
      device({
        deviceType: 'usb',
        origin: 'app://mdconnect',
        device: { ...MZ_NE410, productId: 0x9999 },
      }),
    ).toBe(false);
    expect(device({ deviceType: 'usb', origin: 'https://evil.example', device: MZ_NE410 })).toBe(
      false,
    );
    for (const origin of ['app://mdconnect//', 'app://mdconnect.evil/']) {
      expect(device({ deviceType: 'usb', origin, device: MZ_NE410 })).toBe(false);
    }
  });
});
