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
