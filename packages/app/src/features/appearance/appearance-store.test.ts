import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_APPEARANCE_CHOICE } from './appearance-choice';
import {
  APPEARANCE_STORAGE_KEY,
  createAppearanceStore,
  type StorageLike,
} from './appearance-store';

function memoryStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError');
  },
};

/** A minimal stand-in for `window`'s `storage` events. */
function storageEvents() {
  const target = new EventTarget();
  const fire = (key: string | null, newValue: string | null) => {
    target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
  };
  return { target, fire };
}

describe('createAppearanceStore (ui-theme: "Choice survives a restart", "Corrupt stored value")', () => {
  it('saves a choice that a new store reads back, as after a restart', () => {
    const storage = memoryStorage();
    createAppearanceStore(storage).save({ theme: 'dark', transparency: 'reduced' });
    expect(createAppearanceStore(storage).load()).toEqual({
      theme: 'dark',
      transparency: 'reduced',
    });
    expect(storage.data.has(APPEARANCE_STORAGE_KEY)).toBe(true);
  });

  it('reads System when nothing or garbage is stored', () => {
    expect(createAppearanceStore(memoryStorage()).load()).toEqual(DEFAULT_APPEARANCE_CHOICE);
    expect(
      createAppearanceStore(memoryStorage({ [APPEARANCE_STORAGE_KEY]: '{oops' })).load(),
    ).toEqual(DEFAULT_APPEARANCE_CHOICE);
  });

  it('survives storage that throws, reading System and reporting the failed save', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createAppearanceStore(throwing);
    expect(store.load()).toEqual(DEFAULT_APPEARANCE_CHOICE);
    expect(store.save({ theme: 'light', transparency: 'glass' })).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('works without storage at all', () => {
    const store = createAppearanceStore(null);
    expect(store.load()).toEqual(DEFAULT_APPEARANCE_CHOICE);
    expect(store.save({ theme: 'light', transparency: 'glass' })).toBe(false);
  });

  it('reports a change saved by another tab, and ignores other keys', () => {
    const { target, fire } = storageEvents();
    const store = createAppearanceStore(memoryStorage(), target);
    const seen: unknown[] = [];
    const unsubscribe = store.subscribe((choice) => seen.push(choice));
    fire('something-else', '{"theme":"dark"}');
    fire(APPEARANCE_STORAGE_KEY, '{"theme":"dark","transparency":"glass"}');
    fire(null, null); // storage.clear() in another tab
    unsubscribe();
    fire(APPEARANCE_STORAGE_KEY, '{"theme":"light"}');
    expect(seen).toEqual([{ theme: 'dark', transparency: 'glass' }, DEFAULT_APPEARANCE_CHOICE]);
  });
});
