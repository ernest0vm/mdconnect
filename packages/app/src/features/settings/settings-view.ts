import {
  SERVICE_NAMES,
  type RecognitionPreferences,
  type RecognitionService,
} from '../recognition/recognition-preferences';
import type { UploadPreferences } from '../upload/upload-preferences';
import { ONLINE_ENCODER_HOST } from '../upload/upload-view';

export interface ConsentStatus {
  readonly text: string;
  readonly canWithdraw: boolean;
}

/** Shown when the browser refused to store a change, such as a withdrawn consent. */
export const SAVE_FAILED_TEXT =
  'This browser did not let mdconnect save the change, so it lasts only until the app is reloaded or closed. To withdraw consent to the online encoder for good, clear this site’s stored data before reloading.';

/** Whether audio may be sent to the online encoder, and whether there is a consent to withdraw. */
export function consentStatus(preferences: UploadPreferences): ConsentStatus {
  return preferences.onlineConsent
    ? {
        text: `You agreed to send audio to ${ONLINE_ENCODER_HOST} for LP encoding.`,
        canWithdraw: true,
      }
    : {
        text: `You have not agreed to send audio to ${ONLINE_ENCODER_HOST}. The Add tracks dialog asks before the first online upload.`,
        canWithdraw: false,
      };
}

/** The Settings dialog's sections, in order. */
export const SETTINGS_SECTIONS = ['Appearance', 'Titles', 'Uploads', 'Song recognition'] as const;

const RECOGNITION_STATUS: Readonly<
  Record<RecognitionService, { readonly sent: string; readonly asks: string }>
> = {
  shazam: {
    sent: 'signatures of what mdconnect hears',
    asks: 'it first uses Shazam',
  },
  acoustid: {
    sent: 'fingerprints of what mdconnect hears',
    asks: 'it first uses AcoustID',
  },
  musicbrainz: { sent: 'the text you search for', asks: 'the first search' },
};

/** Whether data may be sent to a recognition service, and whether there is a consent to withdraw. */
export function recognitionConsentStatus(
  preferences: RecognitionPreferences,
  service: RecognitionService,
): ConsentStatus {
  const { sent, asks } = RECOGNITION_STATUS[service];
  const name = SERVICE_NAMES[service];
  return preferences.consent[service]
    ? { text: `${name}: you agreed to send it ${sent}.`, canWithdraw: true }
    : { text: `${name}: no consent given. Identify asks before ${asks}.`, canWithdraw: false };
}

/** The withdraw action's name, which says whose consent it withdraws. */
export const withdrawLabel = (service: RecognitionService): string =>
  `Withdraw consent to ${SERVICE_NAMES[service]}`;

/** Shown when the browser refused to store a song recognition change. */
const RECOGNITION_SAVE_FAILED_TEXT =
  'This browser did not let mdconnect save the change to song recognition, so it lasts only until the app is reloaded or closed. To withdraw consent to a recognition service for good, clear this site’s stored data before reloading.';

/** What to say about changes the browser refused to store, or null when everything was stored. */
export function saveFailedText(saved: {
  readonly uploads: boolean;
  readonly recognition: boolean;
}): string | null {
  if (!saved.uploads) return SAVE_FAILED_TEXT;
  if (!saved.recognition) return RECOGNITION_SAVE_FAILED_TEXT;
  return null;
}
