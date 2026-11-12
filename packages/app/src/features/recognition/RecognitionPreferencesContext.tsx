import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { browserStorage } from '../../browser-storage';
import {
  createRecognitionConsentGuard,
  createRecognitionPreferencesStore,
  type RecognitionPreferences,
} from './recognition-preferences';

interface RecognitionPreferencesValue {
  readonly preferences: RecognitionPreferences;
  readonly setPreferences: (preferences: RecognitionPreferences) => void;
  /** False when the browser refused to store the last change. */
  readonly saved: boolean;
}

const RecognitionPreferencesContext = createContext<RecognitionPreferencesValue | null>(null);

/**
 * Holds the song recognition choices and consents, remembered across launches and shared between
 * the Identify dialog, Settings and other tabs.
 */
export function RecognitionPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const store = useMemo(() => createRecognitionPreferencesStore(browserStorage(), window), []);
  const [preferences, setPreferencesState] = useState(() => store.load());
  const [saved, setSaved] = useState(true);
  const guard = useMemo(() => createRecognitionConsentGuard(), []);

  useEffect(
    () =>
      store.subscribe((incoming) => {
        setPreferencesState(guard.fromOtherTab(incoming));
      }),
    [store, guard],
  );

  const value = useMemo<RecognitionPreferencesValue>(
    () => ({
      preferences,
      setPreferences: (next) => {
        setPreferencesState(next);
        const stored = store.save(next);
        setSaved(stored);
        guard.afterSave(preferences, next, stored);
      },
      saved,
    }),
    [preferences, saved, store, guard],
  );

  return (
    <RecognitionPreferencesContext.Provider value={value}>
      {children}
    </RecognitionPreferencesContext.Provider>
  );
}

/** The recognition preferences; render inside `RecognitionPreferencesProvider`. */
export function useRecognitionPreferences(): RecognitionPreferencesValue {
  const value = useContext(RecognitionPreferencesContext);
  if (value === null) {
    throw new Error('useRecognitionPreferences needs a RecognitionPreferencesProvider above it');
  }
  return value;
}
