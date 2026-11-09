import { GlassProvider, usePreferences } from '@mdconnect/ui/components/glassyui/glass-provider';
import { syncColorSchemeClass } from '@mdconnect/ui/theme';
import { useEffect, useState, type ReactNode } from 'react';

import { resolveAppearance, type SystemAppearance } from './features/appearance/appearance-choice';
import {
  AppearanceChoiceProvider,
  useAppearanceChoice,
} from './features/appearance/AppearanceChoiceContext';
import {
  readSystemAppearance,
  watchSystemAppearance,
} from './features/appearance/system-appearance';
import type { PlatformAppearance } from './platform';

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

/** The OS signals, kept current. */
function useSystemAppearance(appearance: PlatformAppearance | undefined): SystemAppearance {
  const [system, setSystem] = useState(() => readSystemAppearance(window, appearance));

  // The platform's `appearance` object is created once per shell, so the initial read stays valid.
  useEffect(() => watchSystemAppearance(window, appearance, setSystem), [appearance]);

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
