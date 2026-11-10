import { describe, expect, it } from 'vitest';

import { DEFAULT_UPLOAD_PREFERENCES } from '../upload/upload-preferences';
import { initialMode, recordingModes } from '../upload/upload-view';
import { consentStatus, SETTINGS_MODES } from './settings-view';

/** Sony MZ-N510/N610, which has no native mono upload. */
const N510 = { vendorId: 0x054c, productId: 0x00c9 };

describe('Settings view', () => {
  it('offers every recording mode a deck can record', () => {
    expect(SETTINGS_MODES).toEqual(['sp', 'spMono', 'lp2', 'lp4']);
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
});
