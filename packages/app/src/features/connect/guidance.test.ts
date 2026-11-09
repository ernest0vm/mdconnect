import { describe, expect, it } from 'vitest';

import type { OperatingSystem } from '../../platform';
import { guidanceFor, LINUX_SETUP_URL, WINDOWS_SETUP_URL } from './guidance';

const ALL_OS: OperatingSystem[] = ['macos', 'windows', 'linux', 'chromeos', 'other'];

describe('guidanceFor', () => {
  describe('no-device (usb-device-access: "Connect screen" failure message)', () => {
    it.each(ALL_OS)('on %s suggests checking the cable and NetMD/Hi-MD mode', (os) => {
      const { message } = guidanceFor('no-device', os);
      expect(message).toMatch(/no supported MiniDisc device/i);
      expect(message).toMatch(/cable/i);
      expect(message).toMatch(/NetMD or Hi-MD mode/);
    });
  });

  describe('access-denied (usb-device-access: "OS-specific access guidance")', () => {
    it('on Windows explains the USB driver and links to the Windows setup steps', () => {
      const guidance = guidanceFor('access-denied', 'windows');
      expect(guidance.message).toMatch(/USB driver/i);
      expect(guidance.link?.href).toBe(WINDOWS_SETUP_URL);
    });

    it('on Linux explains the device permission and links to the udev setup steps', () => {
      const guidance = guidanceFor('access-denied', 'linux');
      expect(guidance.message).toMatch(/permission/i);
      expect(guidance.link?.href).toBe(LINUX_SETUP_URL);
    });

    it('on macOS suggests closing other apps and reconnecting, without a link', () => {
      const guidance = guidanceFor('access-denied', 'macos');
      expect(guidance.message).toMatch(/other apps/i);
      expect(guidance.message).toMatch(/reconnect/i);
      expect(guidance.link).toBeUndefined();
    });

    it.each(['chromeos', 'other'] as const)('on %s asks to reconnect and retry', (os) => {
      expect(guidanceFor('access-denied', os).message).toMatch(/reconnect/i);
    });
  });

  it.each(ALL_OS)('cancelled on %s says no device was chosen', (os) => {
    expect(guidanceFor('cancelled', os).message).toMatch(/no device was chosen/i);
  });

  it.each(ALL_OS)('unknown on %s asks to reconnect and retry', (os) => {
    expect(guidanceFor('unknown', os).message).toMatch(/reconnect/i);
  });

  it('never shows a raw error, only titled guidance', () => {
    for (const os of ALL_OS) {
      for (const kind of ['no-device', 'cancelled', 'access-denied', 'unknown'] as const) {
        expect(guidanceFor(kind, os).title.length).toBeGreaterThan(0);
      }
    }
  });
});
