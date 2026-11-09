import { GlassProvider, usePreferences } from '@mdconnect/ui/components/glassyui/glass-provider';
import { syncColorSchemeClass } from '@mdconnect/ui/theme';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { resolveAppearance, type SystemAppearance } from './features/appearance/appearance-choice';
import {
  AppearanceChoiceProvider,
  useAppearanceChoice,
} from './features/appearance/AppearanceChoiceContext';
import type { PlatformAppearance } from './platform';

const LIGHT_QUERY = '(prefers-color-scheme: light)';
const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

/**
 * Keeps Tailwind's `dark` class in step with GlassyUI's theme. Every screen inside a GlassProvider
 * renders it, so backgrounds styled with `dark:` match the glass surfaces drawn on top of them.
 */
export function ColorSchemeSync() {
  const { preferences } = usePreferences();

  useEffect(() => {
    syncColorSchemeClass(document.documentElement, preferences.theme);
  }, [preferences.theme]);

  return null;
}

/** The OS signals, kept current: media queries everywhere, plus the desktop shell's own signal. */
function useSystemAppearance(appearance: PlatformAppearance | undefined): SystemAppearance {
  const read = useCallback(
    (): SystemAppearance => ({
      prefersLight: window.matchMedia(LIGHT_QUERY).matches,
      mediaReducedTransparency: window.matchMedia(REDUCED_TRANSPARENCY_QUERY).matches,
      platformReducedTransparency: appearance?.get().prefersReducedTransparency,
    }),
    [appearance],
  );
  const [system, setSystem] = useState(read);

  useEffect(() => {
    const update = () => {
      setSystem(read());
    };
    update();
    const queries = [LIGHT_QUERY, REDUCED_TRANSPARENCY_QUERY].map((q) => window.matchMedia(q));
    queries.forEach((query) => {
      query.addEventListener('change', update);
    });
    const unsubscribe = appearance?.onChange(update);
    return () => {
      queries.forEach((query) => {
        query.removeEventListener('change', update);
      });
      unsubscribe?.();
    };
  }, [appearance, read]);

  return system;
}

/**
 * Applies the user's Appearance choice, resolved against the OS signals, to GlassyUI. "System"
 * follows the OS live; an explicit choice wins over it.
 */
export function AppearanceBridge({ appearance }: { readonly appearance?: PlatformAppearance }) {
  const { setPreferences } = usePreferences();
  const { choice } = useAppearanceChoice();
  const system = useSystemAppearance(appearance);
  const { theme, reduceTransparency } = resolveAppearance(choice, system);

  useEffect(() => {
    setPreferences({ theme, reduceTransparency });
  }, [theme, reduceTransparency, setPreferences]);

  return <ColorSchemeSync />;
}

/** Theme provider, the user's Appearance choice and the bridge between them, for every screen. */
export function AppearanceRoot({
  appearance,
  children,
}: {
  readonly appearance?: PlatformAppearance;
  readonly children: ReactNode;
}) {
  return (
    <GlassProvider>
      <AppearanceChoiceProvider>
        <AppearanceBridge appearance={appearance} />
        {children}
      </AppearanceChoiceProvider>
    </GlassProvider>
  );
}
