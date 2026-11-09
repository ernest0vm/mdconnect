import { usePreferences } from '@mdconnect/ui/components/glassyui/glass-provider';
import { resolveReducedTransparency, syncColorSchemeClass } from '@mdconnect/ui/theme';
import { useEffect } from 'react';

import type { PlatformAppearance } from './platform';

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

/**
 * GlassProvider already follows the OS media queries. This adds the platform's own
 * reduced-transparency signal (desktop) and syncs the colour scheme class.
 */
export function AppearanceBridge({ appearance }: { readonly appearance: PlatformAppearance }) {
  const { setPreferences } = usePreferences();

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

  return <ColorSchemeSync />;
}
