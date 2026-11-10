import { ONLINE_ENCODER_ORIGIN } from '@mdconnect/core';

import type { Encoder, RecordingMode } from '../upload/convert-track';
import type { UploadPreferences } from '../upload/upload-preferences';

/** Every mode a deck can record; the convert dialog falls back to SP where a deck lacks one. */
export const SETTINGS_MODES: readonly RecordingMode[] = ['sp', 'spMono', 'lp2', 'lp4'];

export const SETTINGS_ENCODERS: readonly Encoder[] = ['built-in', 'online'];

export interface ConsentStatus {
  readonly text: string;
  readonly canWithdraw: boolean;
}

const ONLINE_HOST = new URL(ONLINE_ENCODER_ORIGIN).host;

/** Whether audio may be sent to the online encoder, and whether there is a consent to withdraw. */
export function consentStatus(preferences: UploadPreferences): ConsentStatus {
  return preferences.onlineConsent
    ? {
        text: `You agreed to send audio to ${ONLINE_HOST} for LP encoding.`,
        canWithdraw: true,
      }
    : {
        text: `You have not agreed to send audio to ${ONLINE_HOST}. The Add tracks dialog asks before the first online upload.`,
        canWithdraw: false,
      };
}
