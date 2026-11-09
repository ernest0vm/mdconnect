import { describe, expect, it } from 'vitest';

import type { OperatingSystem } from '../../platform';
import {
  connectPrompt,
  guidanceFor,
  replugHint,
  LINUX_SETUP_URL,
  WINDOWS_SETUP_URL,
  type GuidanceContext,
} from './guidance';

const ALL_OS: OperatingSystem[] = ['macos', 'windows', 'linux', 'chromeos', 'other'];
const DESKTOP: GuidanceContext = { platformKind: 'desktop', deviceKinds: ['netmd', 'himd'] };
const WEB: GuidanceContext = { platformKind: 'web', deviceKinds: ['netmd'] };

describe('guidanceFor', () => {
  describe('no-device (usb-device-access: "Connect screen" failure message)', () => {
    it.each(ALL_OS)('on %s suggests checking the cable and NetMD/Hi-MD mode', (os) => {
      const { message } = guidanceFor('no-device', os, DESKTOP);
      expect(message).toMatch(/no supported MiniDisc device/i);
      expect(message).toMatch(/cable/i);
      expect(message).toMatch(/NetMD or Hi-MD mode/);
    });
  });

  describe('access-denied (usb-device-access: "OS-specific access guidance")', () => {
    it('on Windows explains the USB driver and links to the Windows setup steps', () => {
      const guidance = guidanceFor('access-denied', 'windows', DESKTOP);
      expect(guidance.message).toMatch(/USB driver/i);
      expect(guidance.link?.href).toBe(WINDOWS_SETUP_URL);
    });

    it('on Linux explains the device permission and links to the udev setup steps', () => {
      const guidance = guidanceFor('access-denied', 'linux', DESKTOP);
      expect(guidance.message).toMatch(/permission/i);
      expect(guidance.link?.href).toBe(LINUX_SETUP_URL);
    });

    it('on macOS suggests closing other apps and reconnecting, without a link', () => {
      const guidance = guidanceFor('access-denied', 'macos', DESKTOP);
      expect(guidance.message).toMatch(/other apps/i);
      expect(guidance.message).toMatch(/reconnect/i);
      expect(guidance.link).toBeUndefined();
    });

    it.each(['chromeos', 'other'] as const)('on %s asks to reconnect and retry', (os) => {
      expect(guidanceFor('access-denied', os, DESKTOP).message).toMatch(/reconnect/i);
    });
  });

  describe('no-device on the web (usb-device-access: "Web device selection")', () => {
    it.each(ALL_OS)('on %s adds the browser-list hint and the Hi-MD note', (os) => {
      const { message } = guidanceFor('no-device', os, WEB);
      expect(message).toMatch(/browser's list/i);
      expect(message).toMatch(/does not support Hi-MD mode yet/i);
      expect(message).toMatch(/NetMD mode/);
      expect(message).not.toMatch(/desktop app/i);
      expect(message).not.toMatch(/cannot be used in a browser/i);
    });

    it('bases the Hi-MD note on the offered device kinds, not on the platform', () => {
      const webWithHimd: GuidanceContext = { platformKind: 'web', deviceKinds: ['netmd', 'himd'] };
      const { message } = guidanceFor('no-device', 'macos', webWithHimd);
      expect(message).toMatch(/browser's list/i);
      expect(message).toMatch(/NetMD or Hi-MD mode/);
      expect(message).not.toMatch(/does not support Hi-MD/i);
    });

    it('leaves the desktop message without the web hints', () => {
      expect(guidanceFor('no-device', 'macos', DESKTOP).message).not.toMatch(/browser/i);
    });

    it('keeps every other kind identical between web and desktop', () => {
      for (const os of ALL_OS) {
        for (const kind of ['cancelled', 'access-denied', 'unknown'] as const) {
          expect(guidanceFor(kind, os, WEB)).toEqual(guidanceFor(kind, os, DESKTOP));
        }
      }
    });
  });

  it.each(ALL_OS)('cancelled on %s says no device was chosen', (os) => {
    expect(guidanceFor('cancelled', os, DESKTOP).message).toMatch(/no device was chosen/i);
  });

  it.each(ALL_OS)('unknown on %s asks to reconnect and retry', (os) => {
    expect(guidanceFor('unknown', os, DESKTOP).message).toMatch(/reconnect/i);
  });

  it('never shows a raw error, only titled guidance', () => {
    for (const os of ALL_OS) {
      for (const kind of ['no-device', 'cancelled', 'access-denied', 'unknown'] as const) {
        expect(guidanceFor(kind, os, DESKTOP).title.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('connectPrompt (usb-device-access: "Connect screen")', () => {
  it('names NetMD and Hi-MD when both are offered', () => {
    expect(connectPrompt(['netmd', 'himd'])).toBe(
      'Plug in a NetMD or Hi-MD device over USB, then connect to it.',
    );
  });

  it('names NetMD mode only when Hi-MD is not offered (web)', () => {
    const prompt = connectPrompt(['netmd']);
    expect(prompt).toMatch(/NetMD/);
    expect(prompt).not.toMatch(/or Hi-MD device/);
  });
});

describe('replugHint (usb-device-access: "Replug of a device without a USB serial number")', () => {
  const device = (serialNumber?: string) => ({
    name: 'Sony MZ-NE410/NF520D',
    vendorId: 0x054c,
    productId: 0x00ca,
    serialNumber,
  });

  it.each([undefined, ''])(
    'on the web, for a device without a serial number (%j), names it and asks to pick it again',
    (serial) => {
      const hint = replugHint(device(serial), 'web');
      expect(hint).toMatch(/Sony MZ-NE410\/NF520D/);
      expect(hint).toMatch(/Connect device/);
      expect(hint).toMatch(/browser's list again/);
    },
  );

  it('shows nothing when the device has a serial number, since the browser keeps the grant', () => {
    expect(replugHint(device('A1'), 'web')).toBeNull();
  });

  it('shows nothing on desktop, which reconnects on its own', () => {
    expect(replugHint(device(), 'desktop')).toBeNull();
  });

  it('shows nothing when no device was unplugged', () => {
    expect(replugHint(null, 'web')).toBeNull();
  });
});
