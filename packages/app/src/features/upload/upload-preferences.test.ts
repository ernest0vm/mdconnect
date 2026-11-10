import { describe, expect, it } from 'vitest';

import {
  createUploadPreferencesStore,
  DEFAULT_UPLOAD_PREFERENCES,
  UPLOAD_PREFERENCES_KEY,
} from './upload-preferences';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    items,
  };
}

describe('upload preferences', () => {
  it('start with SP, file names, built-in encoder, and everything else off', () => {
    expect(DEFAULT_UPLOAD_PREFERENCES).toEqual({
      mode: 'sp',
      titleSource: 'file',
      fullWidth: false,
      replayGain: false,
      encoder: 'built-in',
      onlineConsent: false,
    });
  });

  it('remember the choices (track-upload: "Remembered mode")', () => {
    const storage = memoryStorage();
    const store = createUploadPreferencesStore(storage);
    const chosen = { ...DEFAULT_UPLOAD_PREFERENCES, mode: 'lp2' as const, replayGain: true };
    expect(store.save(chosen)).toBe(true);
    expect(createUploadPreferencesStore(storage).load()).toEqual(chosen);
  });

  it('fall back field by field when something stored is not valid', () => {
    const storage = memoryStorage({
      [UPLOAD_PREFERENCES_KEY]: JSON.stringify({
        mode: 'lp8',
        titleSource: 'title',
        fullWidth: 'yes',
      }),
    });
    expect(createUploadPreferencesStore(storage).load()).toEqual({
      ...DEFAULT_UPLOAD_PREFERENCES,
      titleSource: 'title',
    });
  });

  it('use the defaults when storage is blocked or holds no JSON', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(createUploadPreferencesStore(throwing).load()).toEqual(DEFAULT_UPLOAD_PREFERENCES);
    expect(createUploadPreferencesStore(throwing).save(DEFAULT_UPLOAD_PREFERENCES)).toBe(false);
    expect(createUploadPreferencesStore(null).load()).toEqual(DEFAULT_UPLOAD_PREFERENCES);
    const garbage = memoryStorage({ [UPLOAD_PREFERENCES_KEY]: '{oops' });
    expect(createUploadPreferencesStore(garbage).load()).toEqual(DEFAULT_UPLOAD_PREFERENCES);
  });
});
