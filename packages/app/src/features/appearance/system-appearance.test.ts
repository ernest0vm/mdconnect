import { describe, expect, it } from 'vitest';

import type { AppearanceSignals, PlatformAppearance } from '../../platform';
import {
  readSystemAppearance,
  watchSystemAppearance,
  type MediaEnvironment,
} from './system-appearance';

/** A `matchMedia` double whose answers the test flips, firing `change` like the browser. */
function fakeMedia(initial: Record<string, boolean>) {
  const matches = { ...initial };
  const listeners = new Map<string, Set<() => void>>();
  const env: MediaEnvironment = {
    matchMedia: (query) => ({
      get matches() {
        return matches[query] ?? false;
      },
      addEventListener: (_type, listener) => {
        const set = listeners.get(query) ?? new Set();
        set.add(listener);
        listeners.set(query, set);
      },
      removeEventListener: (_type, listener) => {
        listeners.get(query)?.delete(listener);
      },
    }),
  };
  const flip = (query: string, value: boolean) => {
    matches[query] = value;
    listeners.get(query)?.forEach((listener) => {
      listener();
    });
  };
  const count = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
  return { env, flip, count };
}

function fakePlatform(initial: AppearanceSignals) {
  let signals = initial;
  const callbacks = new Set<(s: AppearanceSignals) => void>();
  const appearance: PlatformAppearance = {
    get: () => signals,
    onChange: (callback) => {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
  };
  const change = (next: AppearanceSignals) => {
    signals = next;
    callbacks.forEach((callback) => {
      callback(next);
    });
  };
  return { appearance, change, count: () => callbacks.size };
}

const LIGHT = '(prefers-color-scheme: light)';
const REDUCED = '(prefers-reduced-transparency: reduce)';

describe('watchSystemAppearance (ui-theme: "OS switches while running", "Reduced transparency")', () => {
  it('reads the media queries and the platform signal', () => {
    const { env } = fakeMedia({ [LIGHT]: true, [REDUCED]: false });
    const { appearance } = fakePlatform({ prefersReducedTransparency: true });
    expect(readSystemAppearance(env, appearance)).toEqual({
      prefersLight: true,
      mediaReducedTransparency: false,
      platformReducedTransparency: true,
    });
  });

  it('reports every OS change, from either media query or the platform, until stopped', () => {
    const media = fakeMedia({ [LIGHT]: true });
    const platform = fakePlatform({ prefersReducedTransparency: false });
    const seen: boolean[][] = [];
    const stop = watchSystemAppearance(media.env, platform.appearance, (s) => {
      seen.push([
        s.prefersLight,
        s.mediaReducedTransparency,
        s.platformReducedTransparency === true,
      ]);
    });
    media.flip(LIGHT, false);
    media.flip(REDUCED, true);
    platform.change({ prefersReducedTransparency: true });
    stop();
    media.flip(LIGHT, true);
    expect(seen).toEqual([
      [false, false, false],
      [false, true, false],
      [false, true, true],
    ]);
    expect(media.count()).toBe(0);
    expect(platform.count()).toBe(0);
  });

  it('works without a platform signal (the web)', () => {
    const media = fakeMedia({ [REDUCED]: true });
    expect(readSystemAppearance(media.env, undefined).platformReducedTransparency).toBeUndefined();
    const stop = watchSystemAppearance(media.env, undefined, () => undefined);
    stop();
    expect(media.count()).toBe(0);
  });
});
