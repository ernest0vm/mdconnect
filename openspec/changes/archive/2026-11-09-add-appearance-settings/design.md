# Design

## Context

- `GlassProvider` (packages/ui) merges two sources: the OS media queries and an "explicit" set written through `setPreferences`. It persists the explicit set in `localStorage` under `glassy-ui-preferences`, and it has no way to remove a key, so once a value is set it can never go back to "follow the OS".
- `AppearanceBridge` (packages/app) already calls `setPreferences({ reduceTransparency })` with the desktop platform signal ORed with the media query. So that value lands in GlassyUI's persisted explicit set today.
- Theme already follows `prefers-color-scheme` live through `GlassProvider`; `ColorSchemeSync` mirrors the active theme into Tailwind's `dark` class.
- Both shells render the shared screens through `PageShell` (`App` and `UnsupportedBrowser`), so a control placed there reaches every screen in both apps.

## Goals / Non-Goals

**Goals:**

- One source of truth for the user's appearance choice that can express "System".
- Pure, unit-tested resolution of choice + OS signals into the theme and transparency GlassyUI applies.
- An accessible control built from existing components, with no new dependency.

**Non-Goals:**

- Changing GlassyUI's own persistence or API.
- Reduced-motion or quality overrides.

## Decisions

### 1. mdconnect owns the choice; GlassyUI only receives resolved values

The app stores `{ theme: 'system' | 'light' | 'dark', transparency: 'system' | 'reduced' | 'glass' }` under its own `localStorage` key, `mdconnect.appearance`. A pure `resolveAppearance(choice, signals)` turns the choice and the OS signals (`prefers-color-scheme`, the reduced-transparency media query, the desktop platform signal) into `{ theme: 'light' | 'dark', reduceTransparency: boolean }`. `AppearanceBridge` applies the result with `setPreferences` every time the choice or a signal changes.

GlassyUI's persisted explicit set then only mirrors the last resolved values. They match the next launch unless the OS changed while the app was closed. In that case the bridge corrects them on mount.

- Alternative: change `GlassProvider` so `setPreferences` can delete keys and "System" maps to "no explicit value". Rejected. It only covers the theme, because transparency still has to OR in the desktop signal, which GlassyUI cannot see. It would also change shared UI code that both shells' tests rely on.
- Alternative: keep the choice in React state only. Rejected: the spec requires it to survive a restart.

### 2. Parsing is total

`parseAppearanceChoice(raw: string | null)` never throws. Missing JSON, invalid JSON, a non-object or an unknown option all map that field to `'system'`. Reads and writes to `localStorage` are wrapped, because private browsing and storage-blocked profiles throw on access. A failed write keeps the choice for the session and logs a console warning; nothing is shown to the user.

### 3. Storage per target

`localStorage` is used in both apps:

- **Web app:** scoped per browser profile and per origin. A preview deployment and production keep separate choices, which is acceptable.
- **Desktop app:** the `app://mdconnect` origin is a privileged standard scheme. Its `localStorage` lives in Electron's `userData` directory: `~/Library/Application Support/mdconnect` on macOS, `%APPDATA%\mdconnect` on Windows, and `~/.config/mdconnect` on Linux. So the choice is per OS user and survives updates.

No IPC or main-process storage is needed. A `storage` event listener applies a change made in another tab of the web app.

### 4. Control: a footer button and a dialog with native radio groups

`PageShell` renders an "Appearance" `GlassButton` (ghost variant, small) beside `SourceFooter`. It opens a `GlassDialog` with two `<fieldset>`s ("Theme", "Transparency"), each holding three native `<input type="radio">`, styled with Tailwind.

Native radios give arrow-key movement, Space selection and screen-reader group semantics without a new dependency. `GlassDialog` already handles Escape, focus trapping and returning focus to the trigger.

- Alternative: shadcn `RadioGroup` or `ToggleGroup`. Rejected: they add `@radix-ui/react-radio-group` or `@radix-ui/react-toggle-group` for behaviour the platform already provides.
- Alternative: a single cycling button for the theme. Rejected: it cannot show "System", and transparency needs a second control anyway.

### 5. Desktop and web behaviour

The control, storage and resolution are identical in both apps. Only the "System" signals differ:

- **Desktop app:** OS appearance, plus Electron's `nativeTheme` reduced-transparency signal ORed with the media query.
- **Web app:** the browser's media queries only.

On Linux desktops that report no transparency preference, "System" resolves to glass, and "Reduced" still makes the panels opaque. No USB, filesystem or packaging behaviour changes on macOS, Windows or Linux.

### 6. Dependencies

None added.

## Risks / Trade-offs

- [A stale GlassyUI value shows for one frame at launch when the OS changed while the app was closed] → The bridge applies the resolved values in its first effect. The same flash already exists today for transparency on the desktop, so it is not a regression.
- [A browser blocks `localStorage`, so the choice is not remembered] → The choice still applies for the session; the spec accepts "System" as the fallback.
- [Two GlassyUI providers, on the connect screen and the unsupported screen, could disagree] → Only one screen renders at a time, and both read the same stored choice.

## Migration Plan

No migration. Existing users start with both choices on "System", which is today's behaviour. The `reduceTransparency` value the bridge previously wrote to GlassyUI's storage is overwritten by the resolved value on the first render. Rollback is a revert; the unused `mdconnect.appearance` key is harmless.
