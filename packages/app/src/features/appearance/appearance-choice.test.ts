import { describe, expect, it } from 'vitest';

import {
  DEFAULT_APPEARANCE_CHOICE,
  parseAppearanceChoice,
  resolveAppearance,
  serializeAppearanceChoice,
  type AppearanceChoice,
  type SystemAppearance,
} from './appearance-choice';

const darkOs: SystemAppearance = {
  prefersLight: false,
  mediaReducedTransparency: false,
  platformReducedTransparency: undefined,
};

describe('parseAppearanceChoice (ui-theme: "Corrupt stored value")', () => {
  it.each([null, '', 'not json', '42', 'null', '[]', '"dark"'])(
    'falls back to System for %j',
    (raw) => {
      expect(parseAppearanceChoice(raw)).toEqual(DEFAULT_APPEARANCE_CHOICE);
    },
  );

  it('keeps a valid field and resets an unknown one', () => {
    expect(parseAppearanceChoice('{"theme":"dark","transparency":"frosted"}')).toEqual({
      theme: 'dark',
      transparency: 'system',
    });
  });

  it('round-trips every valid choice', () => {
    for (const theme of ['system', 'light', 'dark'] as const) {
      for (const transparency of ['system', 'reduced', 'glass'] as const) {
        const choice: AppearanceChoice = { theme, transparency };
        expect(parseAppearanceChoice(serializeAppearanceChoice(choice))).toEqual(choice);
      }
    }
  });
});

describe('resolveAppearance', () => {
  it('follows the OS theme on System (ui-theme: "Dark OS at launch")', () => {
    expect(resolveAppearance(DEFAULT_APPEARANCE_CHOICE, darkOs).theme).toBe('dark');
    expect(
      resolveAppearance(DEFAULT_APPEARANCE_CHOICE, { ...darkOs, prefersLight: true }).theme,
    ).toBe('light');
  });

  it('lets a picked theme win over the OS (ui-theme: "Theme picked in the app")', () => {
    const light: AppearanceChoice = { ...DEFAULT_APPEARANCE_CHOICE, theme: 'light' };
    expect(resolveAppearance(light, darkOs).theme).toBe('light');
    const dark: AppearanceChoice = { ...DEFAULT_APPEARANCE_CHOICE, theme: 'dark' };
    expect(resolveAppearance(dark, { ...darkOs, prefersLight: true }).theme).toBe('dark');
  });

  it.each([
    // [media query, platform signal, expected]
    [false, undefined, false],
    [true, undefined, true],
    [false, true, true],
    [false, false, false],
    [true, false, true],
  ] as const)(
    'on System ORs the media query (%s) with the platform signal (%s) (ui-theme: "Reduced transparency", "Preference not reported")',
    (media, platform, expected) => {
      expect(
        resolveAppearance(DEFAULT_APPEARANCE_CHOICE, {
          ...darkOs,
          mediaReducedTransparency: media,
          platformReducedTransparency: platform,
        }).reduceTransparency,
      ).toBe(expected);
    },
  );

  it('lets a picked transparency win over the OS (ui-theme: "Transparency picked in the app")', () => {
    const reduced: AppearanceChoice = { ...DEFAULT_APPEARANCE_CHOICE, transparency: 'reduced' };
    expect(resolveAppearance(reduced, darkOs).reduceTransparency).toBe(true);
    const glass: AppearanceChoice = { ...DEFAULT_APPEARANCE_CHOICE, transparency: 'glass' };
    expect(
      resolveAppearance(glass, {
        ...darkOs,
        mediaReducedTransparency: true,
        platformReducedTransparency: true,
      }).reduceTransparency,
    ).toBe(false);
  });
});
