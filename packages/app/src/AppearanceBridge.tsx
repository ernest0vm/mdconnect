import { usePreferences } from '@mdconnect/ui/components/glassyui/glass-provider';
import { resolveReducedTransparency, syncColorSchemeClass } from '@mdconnect/ui/theme';
import { useEffect } from 'react';

import type { PlatformAppearance } from './platform';

const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

/**
 * GlassProvider already follows the OS media queries. This adds the platform's own
 * reduced-transparency signal (desktop) and keeps Tailwind's `dark` class in step.
 */
export function AppearanceBridge({ appearance }: { readonly appearance: PlatformAppearance }) {
  const { preferences, setPreferences } = usePreferences();

  useEffect(() => {
    syncColorSchemeClass(document.documentElement, preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_TRANSPARENCY_QUERY);
    const apply = () => {
      const signal = appearance.get().prefersReducedTransparency;
      if (signal === undefined) return;
      setPreferences({ reduceTransparency: resolveReducedTransparency(signal, media.matches) });
    };
    apply();
    const unsubscribe = appearance.onChange(apply);
    media.addEventListener('change', apply);
    return () => {
      unsubscribe();
      media.removeEventListener('change', apply);
    };
  }, [appearance, setPreferences]);

  return null;
}
