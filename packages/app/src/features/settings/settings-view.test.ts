import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RECOGNITION_PREFERENCES,
  withConsent,
  withdrawRecognitionConsent,
} from '../recognition/recognition-preferences';
import { DEFAULT_UPLOAD_PREFERENCES } from '../upload/upload-preferences';
import { initialMode, RECORDING_MODES, recordingModes } from '../upload/upload-view';
import {
  consentStatus,
  recognitionConsentStatus,
  saveFailedText,
  SAVE_FAILED_TEXT,
  SETTINGS_SECTIONS,
  withdrawLabel,
} from './settings-view';

/** Sony MZ-N510/N610, which has no native mono upload. */
const N510 = { vendorId: 0x054c, productId: 0x00c9 };

describe('Settings view', () => {
  it('offers every recording mode a deck can record', () => {
    expect(RECORDING_MODES).toEqual(['sp', 'spMono', 'lp2', 'lp4']);
  });

  it('starts the convert dialog in the mode picked in Settings (app-settings: "Default mode from Settings")', () => {
    const chosen = { ...DEFAULT_UPLOAD_PREFERENCES, mode: 'lp4' as const };
    expect(initialMode(chosen.mode, recordingModes(N510.vendorId, N510.productId))).toBe('lp4');
  });

  it('falls back to SP when the deck does not record the mode picked in Settings', () => {
    const chosen = { ...DEFAULT_UPLOAD_PREFERENCES, mode: 'spMono' as const };
    expect(initialMode(chosen.mode, recordingModes(N510.vendorId, N510.productId))).toBe('sp');
  });

  it('says consent was given and offers to withdraw it (app-settings: "Withdraw")', () => {
    const status = consentStatus({ ...DEFAULT_UPLOAD_PREFERENCES, onlineConsent: true });
    expect(status.canWithdraw).toBe(true);
    expect(status.text).toMatch(/You agreed/u);
    expect(status.text).toContain('atrac.minidisc.wiki');
  });

  it('says no consent is given and offers nothing to withdraw (app-settings: "Nothing to withdraw")', () => {
    const status = consentStatus(DEFAULT_UPLOAD_PREFERENCES);
    expect(status.canWithdraw).toBe(false);
    expect(status.text).toMatch(/not agreed/u);
  });

  it('says an unsaved change lasts only until a reload, and how to withdraw consent for good', () => {
    expect(SAVE_FAILED_TEXT).toMatch(/until the app is reloaded/u);
    expect(SAVE_FAILED_TEXT).toMatch(/clear this site’s stored data/u);
  });
});

describe('Song recognition in Settings', () => {
  it('has its own section (app-settings: "Open from the Connect screen")', () => {
    expect(SETTINGS_SECTIONS).toEqual(['Appearance', 'Titles', 'Uploads', 'Song recognition']);
  });

  it('says each service’s consent and offers to withdraw only that one (app-settings: "Withdraw one service")', () => {
    const agreed = withConsent(withConsent(DEFAULT_RECOGNITION_PREFERENCES, 'shazam'), 'acoustid');
    expect(recognitionConsentStatus(agreed, 'shazam')).toEqual({
      text: 'Shazam: you agreed to send it signatures of what mdconnect hears.',
      canWithdraw: true,
    });
    const withdrawn = withdrawRecognitionConsent(agreed, 'shazam');
    expect(recognitionConsentStatus(withdrawn, 'shazam').canWithdraw).toBe(false);
    expect(recognitionConsentStatus(withdrawn, 'acoustid').canWithdraw).toBe(true);
  });

  it('offers nothing to withdraw without consent (app-settings: "Nothing to withdraw")', () => {
    expect(recognitionConsentStatus(DEFAULT_RECOGNITION_PREFERENCES, 'musicbrainz')).toEqual({
      text: 'MusicBrainz: no consent given. Identify asks before the first search.',
      canWithdraw: false,
    });
  });
});

describe('Settings for each recognition service', () => {
  it('names the service on its withdraw action', () => {
    expect(withdrawLabel('acoustid')).toBe('Withdraw consent to AcoustID');
  });

  it('says which consent could not be saved', () => {
    expect(saveFailedText({ uploads: true, recognition: false })).toMatch(/song recognition/u);
    expect(saveFailedText({ uploads: false, recognition: true })).toBe(SAVE_FAILED_TEXT);
    expect(saveFailedText({ uploads: true, recognition: true })).toBeNull();
  });
});
