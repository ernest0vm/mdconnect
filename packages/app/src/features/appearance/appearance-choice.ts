import { resolveReducedTransparency, type ColorScheme } from '@mdconnect/ui/theme';

export const THEME_OPTIONS = ['system', 'light', 'dark'] as const;
export const TRANSPARENCY_OPTIONS = ['system', 'reduced', 'glass'] as const;

export type ThemeOption = (typeof THEME_OPTIONS)[number];
export type TransparencyOption = (typeof TRANSPARENCY_OPTIONS)[number];

/** What the user picked in the Appearance control; "system" follows the OS. */
export interface AppearanceChoice {
  readonly theme: ThemeOption;
  readonly transparency: TransparencyOption;
}

export const DEFAULT_APPEARANCE_CHOICE: AppearanceChoice = {
  theme: 'system',
  transparency: 'system',
};

/** The OS signals a "system" choice follows. */
export interface SystemAppearance {
  /** `prefers-color-scheme: light`. */
  readonly prefersLight: boolean;
  /** `prefers-reduced-transparency: reduce`. */
  readonly mediaReducedTransparency: boolean;
  /** The desktop shell's own signal (Electron `nativeTheme`); undefined on the web. */
  readonly platformReducedTransparency: boolean | undefined;
}

/** The values GlassyUI applies. */
export interface ResolvedAppearance {
  readonly theme: ColorScheme;
  readonly reduceTransparency: boolean;
}

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

/** Reads a stored choice. Never throws: anything missing or unknown becomes "system". */
export function parseAppearanceChoice(raw: string | null): AppearanceChoice {
  let value: unknown;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    return DEFAULT_APPEARANCE_CHOICE;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_APPEARANCE_CHOICE;
  }
  const { theme, transparency } = value as Record<string, unknown>;
  return {
    theme: isOneOf(THEME_OPTIONS, theme) ? theme : 'system',
    transparency: isOneOf(TRANSPARENCY_OPTIONS, transparency) ? transparency : 'system',
  };
}

export function serializeAppearanceChoice(choice: AppearanceChoice): string {
  return JSON.stringify({ theme: choice.theme, transparency: choice.transparency });
}

/**
 * Turns the user's choice and the OS signals into what GlassyUI applies. An explicit choice wins;
 * on "system", reduced transparency is on when either the platform or the media query reports it.
 */
export function resolveAppearance(
  choice: AppearanceChoice,
  system: SystemAppearance,
): ResolvedAppearance {
  const theme: ColorScheme =
    choice.theme === 'system' ? (system.prefersLight ? 'light' : 'dark') : choice.theme;
  const reduceTransparency =
    choice.transparency === 'system'
      ? resolveReducedTransparency(
          system.platformReducedTransparency,
          system.mediaReducedTransparency,
        )
      : choice.transparency === 'reduced';
  return { theme, reduceTransparency };
}
