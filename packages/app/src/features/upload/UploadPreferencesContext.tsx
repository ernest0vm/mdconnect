import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  createUploadPreferencesStore,
  fromOtherTab,
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
  const [saved, setSaved] = useState(true);
  /** A consent withdrawal the browser refused to store, which must outlast other tabs' saves. */
  const withdrawalUnsaved = useRef(false);

  useEffect(
    () =>
      store.subscribe((incoming) => {
        setPreferencesState(fromOtherTab(incoming, withdrawalUnsaved.current));
      }),
    [store],
  );

  const value = useMemo<UploadPreferencesValue>(
    () => ({
      preferences,
      setPreferences: (next) => {
        setPreferencesState(next);
        const ok = store.save(next);
        setSaved(ok);
        // Consenting again, or a stored withdrawal, ends the need to override other tabs.
        if (next.onlineConsent || ok) withdrawalUnsaved.current = false;
        else if (preferences.onlineConsent) withdrawalUnsaved.current = true;
      },
      saved,
    }),
    [preferences, saved, store],
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
