import { describe, expect, it } from 'vitest';

import { APP_ORIGIN, isAppOrigin, isSafeExternalUrl } from './url-policy';

describe('isSafeExternalUrl (desktop-shell: "Navigation lock")', () => {
  it.each(['https://www.minidisc.wiki/guides', 'http://example.com'])('allows %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'app://mdconnect/index.html',
    'mailto:someone@example.com',
    'not a url',
  ])('denies %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});

describe('isAppOrigin', () => {
  const dev = { packaged: false, devServerUrl: 'http://localhost:5173/' };
  const packaged = { packaged: true, devServerUrl: 'http://localhost:5173/' };

  it('always accepts the app origin', () => {
    expect(isAppOrigin(APP_ORIGIN, dev)).toBe(true);
    expect(isAppOrigin(APP_ORIGIN, packaged)).toBe(true);
  });

  it('accepts the dev-server origin only in development', () => {
    expect(isAppOrigin('http://localhost:5173', dev)).toBe(true);
    expect(isAppOrigin('http://localhost:5173', packaged)).toBe(false);
  });

  it('accepts the origin serialized with a trailing slash, as the permission check handler passes it', () => {
    expect(isAppOrigin(`${APP_ORIGIN}/`, packaged)).toBe(true);
    expect(isAppOrigin('http://localhost:5173/', dev)).toBe(true);
  });

  it('rejects a path or anything else after the origin', () => {
    expect(isAppOrigin(`${APP_ORIGIN}/index.html`, packaged)).toBe(false);
    expect(isAppOrigin(`${APP_ORIGIN}//`, packaged)).toBe(false);
    expect(isAppOrigin(`${APP_ORIGIN}.evil/`, packaged)).toBe(false);
  });

  it('rejects other origins', () => {
    expect(isAppOrigin('https://evil.example', dev)).toBe(false);
    expect(isAppOrigin('http://localhost:5174', dev)).toBe(false);
    expect(isAppOrigin('file://', { packaged: false, devServerUrl: undefined })).toBe(false);
  });
});
