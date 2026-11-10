import { describe, expect, it } from 'vitest';

import {
  createUploadPreferencesStore,
  DEFAULT_UPLOAD_PREFERENCES,
  UPLOAD_PREFERENCES_KEY,
  withdrawConsent,
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

/** A minimal stand-in for `window`'s `storage` events. */
function storageEvents() {
  const target = new EventTarget();
  const fire = (key: string | null, newValue: string | null) => {
    target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
  };
  return { target, fire };
}

describe('upload preferences', () => {
  it('start with SP, file names, built-in encoder, full-width titles on and the rest off (app-settings: "Default")', () => {
    expect(DEFAULT_UPLOAD_PREFERENCES).toEqual({
      mode: 'sp',
      titleSource: 'file',
      fullWidth: true,
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

  it('keep full-width titles off when the convert dialog stored that choice', () => {
    const storage = memoryStorage({
      [UPLOAD_PREFERENCES_KEY]: JSON.stringify({ ...DEFAULT_UPLOAD_PREFERENCES, fullWidth: false }),
    });
    expect(createUploadPreferencesStore(storage).load().fullWidth).toBe(false);
  });

  it('report preferences saved by another tab, and ignore other keys', () => {
    const { target, fire } = storageEvents();
    const store = createUploadPreferencesStore(memoryStorage(), target);
    const seen: unknown[] = [];
    const unsubscribe = store.subscribe((preferences) => seen.push(preferences));
    fire('mdconnect.appearance', '{"theme":"dark"}');
    fire(UPLOAD_PREFERENCES_KEY, '{"mode":"lp4"}');
    fire(null, null); // storage.clear() in another tab
    unsubscribe();
    fire(UPLOAD_PREFERENCES_KEY, '{"mode":"lp2"}');
    expect(seen).toEqual([
      { ...DEFAULT_UPLOAD_PREFERENCES, mode: 'lp4' },
      DEFAULT_UPLOAD_PREFERENCES,
    ]);
  });

  it('report nothing without an event source', () => {
    const store = createUploadPreferencesStore(memoryStorage());
    expect(() => {
      store.subscribe(() => undefined)();
    }).not.toThrow();
  });

  it('withdraw the online consent and keep every other choice (app-settings: "Withdraw")', () => {
    const agreed = { ...DEFAULT_UPLOAD_PREFERENCES, mode: 'lp2' as const, onlineConsent: true };
    expect(withdrawConsent(agreed)).toEqual({ ...agreed, onlineConsent: false });
  });
});
