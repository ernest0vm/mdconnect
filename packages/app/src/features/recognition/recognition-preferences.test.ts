import { describe, expect, it } from 'vitest';

import {
  availableMethod,
  createRecognitionConsentGuard,
  createRecognitionPreferencesStore,
  DEFAULT_RECOGNITION_PREFERENCES,
  RECOGNITION_PREFERENCES_KEY,
  withConsent,
  withdrawRecognitionConsent,
} from './recognition-preferences';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

describe('recognition preferences', () => {
  it('start with Shazam, the title alone and no consent', () => {
    expect(createRecognitionPreferencesStore(memoryStorage()).load()).toEqual({
      method: 'shazam',
      titleFormat: 'title',
      consent: { shazam: false, acoustid: false, musicbrainz: false },
    });
  });

  it('remember the method and format (song-recognition: "Remembered method")', () => {
    const storage = memoryStorage();
    const store = createRecognitionPreferencesStore(storage);
    store.save({
      ...DEFAULT_RECOGNITION_PREFERENCES,
      method: 'acoustid',
      titleFormat: 'artist-title',
    });
    expect(createRecognitionPreferencesStore(storage).load()).toMatchObject({
      method: 'acoustid',
      titleFormat: 'artist-title',
    });
  });

  it('keep each service’s consent apart (song-recognition: "Consent per service")', () => {
    const agreed = withConsent(DEFAULT_RECOGNITION_PREFERENCES, 'acoustid');
    expect(agreed.consent).toEqual({ shazam: false, acoustid: true, musicbrainz: false });
  });

  it('withdraw one service and keep the others (app-settings: "Withdraw one service")', () => {
    const both = withConsent(withConsent(DEFAULT_RECOGNITION_PREFERENCES, 'shazam'), 'acoustid');
    expect(withdrawRecognitionConsent(both, 'shazam').consent).toEqual({
      shazam: false,
      acoustid: true,
      musicbrainz: false,
    });
  });

  it('ignore stored values that are not valid', () => {
    const storage = memoryStorage({
      [RECOGNITION_PREFERENCES_KEY]: JSON.stringify({
        method: 'radio',
        consent: { shazam: 'yes' },
      }),
    });
    expect(createRecognitionPreferencesStore(storage).load()).toEqual(
      DEFAULT_RECOGNITION_PREFERENCES,
    );
  });
});

describe('availableMethod (song-recognition: "Shazam in the web app")', () => {
  it('uses AcoustID instead of a remembered Shazam where Shazam is unavailable', () => {
    expect(availableMethod('shazam', false)).toBe('acoustid');
    expect(availableMethod('shazam', true)).toBe('shazam');
    expect(availableMethod('search', false)).toBe('search');
  });
});

describe('createRecognitionConsentGuard', () => {
  it('keeps a withdrawal the browser could not store against another tab’s consent', () => {
    const guard = createRecognitionConsentGuard();
    const agreed = withConsent(DEFAULT_RECOGNITION_PREFERENCES, 'shazam');
    guard.afterSave(agreed, withdrawRecognitionConsent(agreed, 'shazam'), false);
    expect(guard.fromOtherTab(agreed).consent.shazam).toBe(false);
    guard.afterSave(DEFAULT_RECOGNITION_PREFERENCES, agreed, true);
    expect(guard.fromOtherTab(agreed).consent.shazam).toBe(true);
  });
});
