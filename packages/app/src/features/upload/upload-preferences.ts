import type { StorageLike } from '../appearance/appearance-store';
import type { Encoder, RecordingMode } from './convert-track';
import type { TitleSource } from './title-source';

/** The convert dialog's choices, kept between uploads. */
export interface UploadPreferences {
  readonly mode: RecordingMode;
  readonly titleSource: TitleSource;
  readonly fullWidth: boolean;
  readonly replayGain: boolean;
  readonly encoder: Encoder;
  /** The user agreed to send audio to the online encoder. */
  readonly onlineConsent: boolean;
}

export const UPLOAD_PREFERENCES_KEY = 'mdconnect.upload';

export const DEFAULT_UPLOAD_PREFERENCES: UploadPreferences = {
  mode: 'sp',
  titleSource: 'file',
  // The rename dialogs showed a full-width field before it became a setting, so it stays on.
  fullWidth: true,
  replayGain: false,
  encoder: 'built-in',
  onlineConsent: false,
};

const MODES: readonly RecordingMode[] = ['sp', 'spMono', 'lp2', 'lp4'];
const SOURCES: readonly TitleSource[] = [
  'file',
  'title',
  'album-title',
  'artist-title',
  'title-artist',
  'artist-album-title',
];
const ENCODERS: readonly Encoder[] = ['built-in', 'online'];

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Reads stored preferences, keeping each valid field and defaulting the rest. */
function parse(text: string | null): UploadPreferences {
  if (text === null) return DEFAULT_UPLOAD_PREFERENCES;
  let stored: unknown;
  try {
    stored = JSON.parse(text);
  } catch {
    return DEFAULT_UPLOAD_PREFERENCES;
  }
  if (typeof stored !== 'object' || stored === null) return DEFAULT_UPLOAD_PREFERENCES;
  const value = stored as Record<string, unknown>;
  const fallback = DEFAULT_UPLOAD_PREFERENCES;
  return {
    mode: pick(value.mode, MODES, fallback.mode),
    titleSource: pick(value.titleSource, SOURCES, fallback.titleSource),
    fullWidth: flag(value.fullWidth, fallback.fullWidth),
    replayGain: flag(value.replayGain, fallback.replayGain),
    encoder: pick(value.encoder, ENCODERS, fallback.encoder),
    onlineConsent: flag(value.onlineConsent, fallback.onlineConsent),
  };
}

export interface UploadPreferencesStore {
  load(): UploadPreferences;
  /** False when the browser refuses to store them (private browsing, blocked storage). */
  save(preferences: UploadPreferences): boolean;
  /** Reports preferences saved by another tab of the same app. */
  subscribe(listener: (preferences: UploadPreferences) => void): () => void;
}

/** The preferences without the online-encoder consent, so the next online upload asks again. */
export const withdrawConsent = (preferences: UploadPreferences): UploadPreferences => ({
  ...preferences,
  onlineConsent: false,
});

/**
 * Preferences saved by another tab, as this tab applies them. A withdrawal this tab could not
 * store stays in effect, so another tab's stored consent cannot bring it back.
 */
export const fromOtherTab = (
  incoming: UploadPreferences,
  withdrawalUnsaved: boolean,
): UploadPreferences => (withdrawalUnsaved ? withdrawConsent(incoming) : incoming);

/** Keeps upload preferences in `localStorage`, like the Appearance choice. */
export function createUploadPreferencesStore(
  storage: StorageLike | null,
  events: EventTarget | null = null,
): UploadPreferencesStore {
  return {
    load() {
      try {
        return parse(storage?.getItem(UPLOAD_PREFERENCES_KEY) ?? null);
      } catch {
        return DEFAULT_UPLOAD_PREFERENCES;
      }
    },
    save(preferences) {
      if (storage === null) return false;
      try {
        storage.setItem(UPLOAD_PREFERENCES_KEY, JSON.stringify(preferences));
        return true;
      } catch {
        return false;
      }
    },
    subscribe(listener) {
      if (events === null) return () => undefined;
      const onStorage = (event: Event) => {
        const { key, newValue } = event as Partial<StorageEvent>;
        // A null key means another tab cleared the whole storage.
        if (key === UPLOAD_PREFERENCES_KEY || key === null) listener(parse(newValue ?? null));
      };
      events.addEventListener('storage', onStorage);
      return () => {
        events.removeEventListener('storage', onStorage);
      };
    },
  };
}
