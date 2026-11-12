import { describe, expect, it } from 'vitest';

import { permissionCheck, permissionRequest } from './permissions';

const origins = { packaged: true, devServerUrl: undefined } as const;
const APP = 'app://mdconnect/';
const PAGE = 'app://mdconnect/index.html';

describe('permissionCheck', () => {
  it('grants usb to the app origin as Electron passes it (usb-device-access: "Connect screen")', () => {
    expect(permissionCheck('usb', APP, {}, origins)).toBe(true);
    expect(permissionCheck('usb', 'https://evil.example/', {}, origins)).toBe(false);
  });

  it('grants audio media checks to the app origin only (desktop-shell: "Audio capture allowed")', () => {
    expect(permissionCheck('media', APP, { mediaType: 'audio' }, origins)).toBe(true);
    expect(permissionCheck('media', 'https://evil.example/', { mediaType: 'audio' }, origins)).toBe(
      false,
    );
  });

  it('refuses video and unspecified media checks (desktop-shell: "Video refused")', () => {
    expect(permissionCheck('media', APP, { mediaType: 'video' }, origins)).toBe(false);
    expect(permissionCheck('media', APP, {}, origins)).toBe(false);
  });

  it('refuses everything else (desktop-shell: "Other permission refused")', () => {
    for (const permission of ['notifications', 'geolocation', 'hid', 'speaker-selection']) {
      expect(permissionCheck(permission, APP, {}, origins)).toBe(false);
    }
  });
});

describe('permissionRequest', () => {
  const audio = { mediaTypes: ['audio'], securityOrigin: APP, requestingUrl: PAGE };

  it('grants an audio-only media request from the app page (desktop-shell: "Audio capture allowed")', () => {
    expect(permissionRequest('media', audio, origins)).toBe(true);
  });

  it('refuses media requests that include video or name no type (desktop-shell: "Video refused")', () => {
    expect(permissionRequest('media', { ...audio, mediaTypes: ['audio', 'video'] }, origins)).toBe(
      false,
    );
    expect(permissionRequest('media', { ...audio, mediaTypes: ['video'] }, origins)).toBe(false);
    expect(permissionRequest('media', { ...audio, mediaTypes: [] }, origins)).toBe(false);
    expect(permissionRequest('media', { requestingUrl: PAGE }, origins)).toBe(false);
  });

  it('refuses requests from another origin', () => {
    expect(
      permissionRequest(
        'media',
        {
          mediaTypes: ['audio'],
          securityOrigin: 'https://evil.example/',
          requestingUrl: 'https://evil.example/',
        },
        origins,
      ),
    ).toBe(false);
  });

  it('refuses every other permission (desktop-shell: "Other permission refused")', () => {
    for (const permission of ['notifications', 'geolocation', 'fileSystem', 'clipboard-read']) {
      expect(permissionRequest(permission, { requestingUrl: PAGE }, origins)).toBe(false);
    }
  });
});
