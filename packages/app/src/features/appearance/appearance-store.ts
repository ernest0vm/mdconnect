import {
  DEFAULT_APPEARANCE_CHOICE,
  parseAppearanceChoice,
  serializeAppearanceChoice,
  type AppearanceChoice,
} from './appearance-choice';

export const APPEARANCE_STORAGE_KEY = 'mdconnect.appearance';

/** The part of `Storage` the store uses. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface AppearanceStore {
  /** The stored choice, or System when nothing valid is stored or storage is unavailable. */
  load(): AppearanceChoice;
  /** Stores the choice; false (with a console warning) when the browser refuses to store it. */
  save(choice: AppearanceChoice): boolean;
  /** Reports choices saved by another tab of the same app. */
  subscribe(listener: (choice: AppearanceChoice) => void): () => void;
}

/**
 * Remembers the Appearance choice in `localStorage`: per browser profile and site on the web, and
 * in Electron's user data directory on desktop. Every access is guarded, because private browsing
 * and storage-blocked profiles throw.
 */
export function createAppearanceStore(
  storage: StorageLike | null,
  events: EventTarget | null = null,
): AppearanceStore {
  return {
    load() {
      if (storage === null) return DEFAULT_APPEARANCE_CHOICE;
      try {
        return parseAppearanceChoice(storage.getItem(APPEARANCE_STORAGE_KEY));
      } catch {
        return DEFAULT_APPEARANCE_CHOICE;
      }
    },
    save(choice) {
      if (storage === null) return false;
      try {
        storage.setItem(APPEARANCE_STORAGE_KEY, serializeAppearanceChoice(choice));
        return true;
      } catch (error) {
        console.warn('mdconnect: could not remember the appearance choice', error);
        return false;
      }
    },
    subscribe(listener) {
      if (events === null) return () => undefined;
      const onStorage = (event: Event) => {
        const { key, newValue } = event as Partial<StorageEvent>;
        // A null key means another tab cleared the whole storage.
        if (key === APPEARANCE_STORAGE_KEY || key === null) {
          listener(parseAppearanceChoice(newValue ?? null));
        }
      };
      events.addEventListener('storage', onStorage);
      return () => {
        events.removeEventListener('storage', onStorage);
      };
    },
  };
}
