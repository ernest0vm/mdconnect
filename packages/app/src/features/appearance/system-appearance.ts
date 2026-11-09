import type { PlatformAppearance } from '../../platform';
import type { SystemAppearance } from './appearance-choice';

const LIGHT_QUERY = '(prefers-color-scheme: light)';
const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

/** The part of `window` the watcher uses, so tests can stand in for the browser. */
export interface MediaEnvironment {
  matchMedia(query: string): {
    readonly matches: boolean;
    addEventListener(type: 'change', listener: () => void): void;
    removeEventListener(type: 'change', listener: () => void): void;
  };
}

/** The OS signals right now: media queries everywhere, plus the desktop shell's own signal. */
export function readSystemAppearance(
  env: MediaEnvironment,
  appearance: PlatformAppearance | undefined,
): SystemAppearance {
  return {
    prefersLight: env.matchMedia(LIGHT_QUERY).matches,
    mediaReducedTransparency: env.matchMedia(REDUCED_TRANSPARENCY_QUERY).matches,
    platformReducedTransparency: appearance?.get().prefersReducedTransparency,
  };
}

/** Calls `onChange` with fresh signals whenever any of them changes; returns the stop function. */
export function watchSystemAppearance(
  env: MediaEnvironment,
  appearance: PlatformAppearance | undefined,
  onChange: (system: SystemAppearance) => void,
): () => void {
  const update = () => {
    onChange(readSystemAppearance(env, appearance));
  };
  const queries = [LIGHT_QUERY, REDUCED_TRANSPARENCY_QUERY].map((query) => env.matchMedia(query));
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
}
