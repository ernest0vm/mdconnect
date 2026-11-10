import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { browserStorage } from '../../browser-storage';
import type { AppearanceChoice } from './appearance-choice';
import { createAppearanceStore, type AppearanceStore } from './appearance-store';

interface AppearanceChoiceValue {
  readonly choice: AppearanceChoice;
  readonly setChoice: (choice: AppearanceChoice) => void;
}

const AppearanceChoiceContext = createContext<AppearanceChoiceValue | null>(null);

function browserStore(): AppearanceStore {
  return createAppearanceStore(browserStorage(), window);
}

/** Holds the user's Appearance choice, remembered across launches and shared between tabs. */
export function AppearanceChoiceProvider({ children }: { readonly children: ReactNode }) {
  const store = useMemo(() => browserStore(), []);
  const [choice, setChoiceState] = useState(() => store.load());

  useEffect(() => store.subscribe(setChoiceState), [store]);

  const value = useMemo<AppearanceChoiceValue>(
    () => ({
      choice,
      setChoice: (next) => {
        setChoiceState(next);
        store.save(next);
      },
    }),
    [choice, store],
  );

  return (
    <AppearanceChoiceContext.Provider value={value}>{children}</AppearanceChoiceContext.Provider>
  );
}

/** The Appearance choice; render inside `AppearanceRoot` (or `AppearanceChoiceProvider`). */
export function useAppearanceChoice(): AppearanceChoiceValue {
  const value = useContext(AppearanceChoiceContext);
  if (value === null) {
    throw new Error('useAppearanceChoice needs an AppearanceChoiceProvider above it');
  }
  return value;
}
