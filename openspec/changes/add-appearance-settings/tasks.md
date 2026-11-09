# Tasks

## 1. Appearance choice model (packages/app)

- [ ] 1.1 Tests first for `parseAppearanceChoice` and `serializeAppearanceChoice`: missing, invalid JSON, non-object and unknown options fall back to `system` per field; a valid value round-trips (ui-theme: "Corrupt stored value").
- [ ] 1.2 Tests first for `resolveAppearance(choice, signals)` covering each theme and transparency option against OS light/dark and the reduced-transparency signals. With `system`, the desktop platform signal and the media query are ORed; an explicit choice wins over the OS (ui-theme: "Dark OS at launch", "Theme picked in the app", "Reduced transparency", "Transparency picked in the app", "Preference not reported").

## 2. Storage and bridge (packages/app)

- [ ] 2.1 Tests first for a storage adapter over a `Storage`-like object: reads and writes `mdconnect.appearance`, survives a throwing `getItem` or `setItem`, and reports changes from another tab through the `storage` event (ui-theme: "Choice survives a restart", "Corrupt stored value").
- [ ] 2.2 Make `AppearanceBridge` read the choice and apply `resolveAppearance(...)` through `setPreferences` on mount and whenever the choice, `prefers-color-scheme`, the reduced-transparency media query or the platform signal changes. Keep `ColorSchemeSync`. Cover the decision logic with the tests from 1.2; the effect wiring is checked in 4.x (ui-theme: "OS switches while running", "Back to System").

## 3. Appearance control (packages/app)

- [ ] 3.1 Add the `AppearanceDialog`: a `GlassDialog` with "Theme" and "Transparency" fieldsets of native radio inputs, bound to the choice. Add its trigger, an "Appearance" ghost `GlassButton`, to `PageShell` beside `SourceFooter`, so the connect screen and the unsupported-browser screen both show it. Put the option labels and ordering in a pure module with tests (ui-theme: "Change theme from the control").
- [ ] 3.2 `yarn check:affected` passes.

## 4. Verification (manual)

- [ ] 4.1 Desktop, macOS, `yarn dev`, manual:
  - With both choices on System, toggle macOS Appearance and Reduce transparency and confirm the app follows live.
  - Pick Light with macOS in Dark: the app turns light and stays light when macOS changes.
  - Pick Reduced with Reduce transparency off: panels are opaque.
  - Quit and relaunch: the choices persist.
  - Pick System again: the app follows macOS.

  (ui-theme: "Theme picked in the app", "Transparency picked in the app", "Back to System", "Choice survives a restart")

- [ ] 4.2 Web, Chrome, `yarn dev:web`, manual:
  - The same checks as 4.1.
  - Change the choice in one tab and confirm a second tab follows.
  - In Safari, the unsupported-browser screen shows the Appearance control and it works.
- [ ] 4.3 Keyboard, manual: Tab to "Appearance", Enter opens the dialog, arrow keys and Space change each group, Escape closes it and focus returns to the trigger. Check in light and dark that every radio and the trigger show a visible focus ring and that text contrast stays at 4.5:1 or more (ui-theme: "Keyboard only", "Readable contrast").

## Workflow follow-up

- Archive with `/opsx:archive` after the verification above is done.
