import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  createUploadPreferencesStore,
  type UploadPreferences,
  type UploadPreferencesStore,
} from './upload-preferences';

interface UploadPreferencesValue {
  readonly preferences: UploadPreferences;
  readonly setPreferences: (preferences: UploadPreferences) => void;
}

const UploadPreferencesContext = createContext<UploadPreferencesValue | null>(null);

/** `window.localStorage` itself throws when a profile blocks storage. */
function browserStore(): UploadPreferencesStore {
  let storage: Storage | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return createUploadPreferencesStore(storage, window);
}

/**
 * Holds the upload preferences and Full-width titles, remembered across launches and shared
 * between Settings, the convert dialog, the rename dialogs and other tabs.
 */
export function UploadPreferencesProvider({ children }: { readonly children: ReactNode }) {
  const store = useMemo(() => browserStore(), []);
  const [preferences, setPreferencesState] = useState(() => store.load());

  useEffect(() => store.subscribe(setPreferencesState), [store]);

  const value = useMemo<UploadPreferencesValue>(
    () => ({
      preferences,
      setPreferences: (next) => {
        setPreferencesState(next);
        store.save(next);
      },
    }),
    [preferences, store],
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
