import { describe, expect, it } from 'vitest';

import { resolveReducedTransparency, syncColorSchemeClass } from './theme';

describe('resolveReducedTransparency', () => {
  it('is on when the platform reports the preference', () => {
    expect(resolveReducedTransparency(true, false)).toBe(true);
  });

  it('is on when the media query reports the preference', () => {
    expect(resolveReducedTransparency(false, true)).toBe(true);
    expect(resolveReducedTransparency(undefined, true)).toBe(true);
  });

  it('is off when neither reports it, including platforms without a signal', () => {
    expect(resolveReducedTransparency(false, false)).toBe(false);
    expect(resolveReducedTransparency(undefined, false)).toBe(false);
  });
});

describe('syncColorSchemeClass', () => {
  const fakeRoot = () => {
    const classes = new Set<string>();
    return {
      classes,
      classList: {
        toggle: (name: string, force?: boolean) => {
          if (force ?? !classes.has(name)) classes.add(name);
          else classes.delete(name);
          return classes.has(name);
        },
      },
    };
  };

  it('adds the Tailwind dark class for the dark theme', () => {
    const root = fakeRoot();
    syncColorSchemeClass(root, 'dark');
    expect(root.classes.has('dark')).toBe(true);
  });

  it('removes it for the light theme', () => {
    const root = fakeRoot();
    root.classes.add('dark');
    syncColorSchemeClass(root, 'light');
    expect(root.classes.has('dark')).toBe(false);
  });
});
