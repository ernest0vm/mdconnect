# Tasks

## 1. Preferences

- [x] 1.1 Add `UploadPreferencesContext` around `createUploadPreferencesStore`, with updates from other tabs through the `storage` event, and use it in the convert dialog. Verify with tests for the provider's load, save and cross-tab update.
- [x] 1.2 Change the `fullWidth` default to on. Verify with a preferences test (app-settings: "Default").

## 2. Settings dialog

- [x] 2.1 Add `SettingsDialog` with the Appearance section (the current controls moved), the Titles section and the Uploads section, plus its view logic (labels, consent state). Verify the view logic with unit tests (app-settings: "Default mode from Settings", "Change in the convert dialog", "Withdraw", "Nothing to withdraw").
- [x] 2.2 Replace the header's Appearance button with Settings in `PageShell`. Check in the browser that the dialog opens on the Connect screen and on the disc screen, works from the keyboard, and returns focus (app-settings: "Open from the Connect screen", "Keyboard only"; ui-theme: "Change theme from the control", "Keyboard only").
- [x] 2.3 Hide the full-width fields in the rename dialogs and the convert dialog when Full-width titles is off. Verify with a view test, and in the browser with `?demo` that a rename keeps the stored full-width title (app-settings: "Turned off"). The demo device replays a read-only recording and refuses every edit, so the browser check covered the rename dialog showing only the half-width field and the convert dialog starting with full-width off; `title-form.test.ts` covers keeping the stored full-width title.

## 3. Manual verification

- [ ] 3.1 In the desktop app and in Chrome, change each setting, reload, and check that it is remembered. Check that an Appearance choice made before this change is kept.
