import type { StorageLike } from '../appearance/appearance-store';
import { TITLE_FORMATS, type TitleFormat } from './title-format';

export type IdentifyMethod = 'shazam' | 'acoustid' | 'search';

/** The services that ask for consent before anything is sent to them. */
export type RecognitionService = 'shazam' | 'acoustid' | 'musicbrainz';

export const RECOGNITION_SERVICES: readonly RecognitionService[] = [
  'shazam',
  'acoustid',
  'musicbrainz',
];

/** The service each method sends data to. */
export const SERVICE_OF: Readonly<Record<IdentifyMethod, RecognitionService>> = {
  shazam: 'shazam',
  acoustid: 'acoustid',
  search: 'musicbrainz',
};

export interface RecognitionPreferences {
  readonly method: IdentifyMethod;
  readonly titleFormat: TitleFormat;
  readonly consent: Readonly<Record<RecognitionService, boolean>>;
}

export const RECOGNITION_PREFERENCES_KEY = 'mdconnect.recognition';

export const DEFAULT_RECOGNITION_PREFERENCES: RecognitionPreferences = {
  method: 'shazam',
  titleFormat: 'title',
  consent: { shazam: false, acoustid: false, musicbrainz: false },
};

const METHODS: readonly IdentifyMethod[] = ['shazam', 'acoustid', 'search'];

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

function parse(text: string | null): RecognitionPreferences {
  const fallback = DEFAULT_RECOGNITION_PREFERENCES;
  let stored: unknown;
  try {
    stored = text === null ? null : JSON.parse(text);
  } catch {
    return fallback;
  }
  if (typeof stored !== 'object' || stored === null) return fallback;
  const value = stored as Record<string, unknown>;
  const consent = (
    typeof value.consent === 'object' && value.consent !== null ? value.consent : {}
  ) as Record<string, unknown>;
  const agreed = (service: RecognitionService) => consent[service] === true;
  return {
    method: pick(value.method, METHODS, fallback.method),
    titleFormat: pick(value.titleFormat, TITLE_FORMATS, fallback.titleFormat),
    consent: {
      shazam: agreed('shazam'),
      acoustid: agreed('acoustid'),
      musicbrainz: agreed('musicbrainz'),
    },
  };
}

/** The method to show: a remembered Shazam becomes AcoustID where Shazam cannot be used. */
export function availableMethod(method: IdentifyMethod, shazamAvailable: boolean): IdentifyMethod {
  return method === 'shazam' && !shazamAvailable ? 'acoustid' : method;
}

export const withConsent = (
  preferences: RecognitionPreferences,
  service: RecognitionService,
): RecognitionPreferences => ({
  ...preferences,
  consent: { ...preferences.consent, [service]: true },
});

export const withdrawRecognitionConsent = (
  preferences: RecognitionPreferences,
  service: RecognitionService,
): RecognitionPreferences => ({
  ...preferences,
  consent: { ...preferences.consent, [service]: false },
});

/** Keeps a withdrawal the browser refused to store in effect against other tabs, per service. */
export interface RecognitionConsentGuard {
  afterSave(previous: RecognitionPreferences, next: RecognitionPreferences, stored: boolean): void;
  fromOtherTab(incoming: RecognitionPreferences): RecognitionPreferences;
}

export function createRecognitionConsentGuard(): RecognitionConsentGuard {
  const unsaved = new Set<RecognitionService>();
  return {
    afterSave(previous, next, stored) {
      for (const service of RECOGNITION_SERVICES) {
        if (next.consent[service] || stored) unsaved.delete(service);
        else if (previous.consent[service]) unsaved.add(service);
      }
    },
    fromOtherTab: (incoming) => [...unsaved].reduce(withdrawRecognitionConsent, incoming),
  };
}

export interface RecognitionPreferencesStore {
  load(): RecognitionPreferences;
  /** False when the browser refuses to store them. */
  save(preferences: RecognitionPreferences): boolean;
  /** Reports preferences saved by another tab. */
  subscribe(listener: (preferences: RecognitionPreferences) => void): () => void;
}

/** Keeps the recognition preferences in `localStorage`, like the upload preferences. */
export function createRecognitionPreferencesStore(
  storage: StorageLike | null,
  events: EventTarget | null = null,
): RecognitionPreferencesStore {
  return {
    load() {
      try {
        return parse(storage?.getItem(RECOGNITION_PREFERENCES_KEY) ?? null);
      } catch {
        return DEFAULT_RECOGNITION_PREFERENCES;
      }
    },
    save(preferences) {
      if (storage === null) return false;
      try {
        storage.setItem(RECOGNITION_PREFERENCES_KEY, JSON.stringify(preferences));
        return true;
      } catch {
        return false;
      }
    },
    subscribe(listener) {
      if (events === null) return () => undefined;
      const onStorage = (event: Event) => {
        const { key, newValue } = event as Partial<StorageEvent>;
        if (key === RECOGNITION_PREFERENCES_KEY || key === null) listener(parse(newValue ?? null));
      };
      events.addEventListener('storage', onStorage);
      return () => {
        events.removeEventListener('storage', onStorage);
      };
    },
  };
}
