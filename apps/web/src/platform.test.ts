import { describe, expect, it } from 'vitest';

import { detectOs, isWebUsbSupported } from './platform';

const UA = {
  macos:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  chromeos:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
};

describe('detectOs', () => {
  it.each([
    ['macOS', 'macos'],
    ['Windows', 'windows'],
    ['Linux', 'linux'],
    ['Chrome OS', 'chromeos'],
    ['ChromeOS', 'chromeos'],
    ['Android', 'other'],
  ] as const)('maps userAgentData platform %s to %s', (platform, os) => {
    expect(detectOs({ userAgentDataPlatform: platform, userAgent: '' })).toBe(os);
  });

  it.each([
    ['macos', UA.macos],
    ['windows', UA.windows],
    ['linux', UA.linux],
    ['chromeos', UA.chromeos],
  ] as const)('falls back to the user agent for %s', (os, userAgent) => {
    expect(detectOs({ userAgentDataPlatform: undefined, userAgent })).toBe(os);
  });

  it('does not mistake iOS ("like Mac OS X") or Android ("Linux") for desktop systems', () => {
    expect(detectOs({ userAgentDataPlatform: undefined, userAgent: UA.iphone })).toBe('other');
    expect(detectOs({ userAgentDataPlatform: undefined, userAgent: UA.android })).toBe('other');
  });

  it('maps anything unknown to other', () => {
    expect(detectOs({ userAgentDataPlatform: 'Fuchsia', userAgent: '' })).toBe('other');
    expect(detectOs({ userAgentDataPlatform: undefined, userAgent: 'curl/8.0' })).toBe('other');
  });
});

describe('isWebUsbSupported (web-delivery: "Supported browsers")', () => {
  it('needs a secure context and navigator.usb', () => {
    expect(isWebUsbSupported({ secureContext: true, hasUsb: true })).toBe(true);
  });

  it('is unsupported without WebUSB (Firefox, Safari)', () => {
    expect(isWebUsbSupported({ secureContext: true, hasUsb: false })).toBe(false);
  });

  it('is unsupported over plain HTTP', () => {
    expect(isWebUsbSupported({ secureContext: false, hasUsb: true })).toBe(false);
  });
});
