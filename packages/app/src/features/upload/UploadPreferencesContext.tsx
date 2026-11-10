import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { browserStorage } from '../../browser-storage';
import {
  createConsentGuard,
  createUploadPreferencesStore,
  type UploadPreferences,
  type UploadPreferencesStore,
} from './upload-preferences';

interface UploadPreferencesValue {
  readonly preferences: UploadPreferences;
  readonly setPreferences: (preferences: UploadPreferences) => void;
  /** False when the browser refused to store the last change, which then lasts until a reload. */
  readonly saved: boolean;
}

const UploadPreferencesContext = createContext<UploadPreferencesValue | null>(null);

function browserStore(): UploadPreferencesStore {
  return createUploadPreferencesStore(browserStorage(), window);
}

/**
 * Holds the upload preferences and Full-width titles, remembered across launches and shared
 * between Settings, the convert dialog, the rename dialogs and other tabs.
 */
export function UploadPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const store = useMemo(() => browserStore(), []);
  const [preferences, setPreferencesState] = useState(() => store.load());
  const [saved, setSaved] = useState(true);
  const guard = useMemo(() => createConsentGuard(), []);

  useEffect(
    () =>
      store.subscribe((incoming) => {
        setPreferencesState(guard.fromOtherTab(incoming));
      }),
    [store, guard],
  );

  const value = useMemo<UploadPreferencesValue>(
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
    <UploadPreferencesContext.Provider value={value}>{children}</UploadPreferencesContext.Provider>
  );
}

/** The upload preferences; render inside `UploadPreferencesProvider`. */
export function useUploadPreferences(): UploadPreferencesValue {
  const value = useContext(UploadPreferencesContext);
  if (value === null) {
    throw new Error('useUploadPreferences needs an UploadPreferencesProvider above it');
  }
  return value;
}
