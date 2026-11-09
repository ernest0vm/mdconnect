/**
 * Appearance helpers. GlassyUI's `GlassProvider` already follows `prefers-color-scheme`,
 * `prefers-reduced-motion` and `prefers-reduced-transparency` live and applies its
 * `data-lg-*` attributes; these helpers add what it cannot know about.
 */

export type ColorScheme = 'light' | 'dark';

/**
 * Reduced transparency is on when either the platform (desktop: Electron's `nativeTheme`) or the
 * browser media query reports it. Neither signal is reliable on every OS, so they are ORed.
 */
export function resolveReducedTransparency(
  platformSignal: boolean | undefined,
  mediaQueryMatches: boolean,
): boolean {
  return platformSignal === true || mediaQueryMatches;
}

/** Keeps Tailwind's `dark:` variant in step with the active GlassyUI theme. */
export function syncColorSchemeClass(
  root: { readonly classList: Pick<DOMTokenList, 'toggle'> },
  scheme: ColorScheme,
): void {
  root.classList.toggle('dark', scheme === 'dark');
}
