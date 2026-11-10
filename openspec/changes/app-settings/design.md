# Design

## Context

- `PageShell` renders `AppearanceDialog` (a `GlassDialog` with theme and transparency radio groups) in the header of the Connect screen and the connected layout. Its choice is stored by `appearance-store.ts` under `mdconnect.appearance` and shared through `AppearanceChoiceContext`.
- Upload preferences are stored by `upload-preferences.ts` under `mdconnect.upload`: mode, title source, full-width, ReplayGain, encoder and online consent. The convert dialog loads them when it opens and saves them on upload.
- The rename dialogs (`TitleDialog`) always show a full-width field.

## Goals / Non-Goals

**Goals:** one place for every choice; existing stored choices keep working; no new storage keys for what already exists.

**Non-Goals:** homebrew settings, encoder installation, and syncing settings across devices.

## Decisions

### 1. Settings replaces the Appearance button

The header button is renamed and opens `SettingsDialog`, which contains the current Appearance controls as its first section, unchanged. That keeps one header control on every screen, where Appearance is today, instead of adding a second button.

Alternative: Settings in the More menu, as webminidisc does. Rejected: More exists only while a device is connected, and Appearance must stay reachable on the Connect screen.

### 2. One store per concern, shared through context

- **Appearance** keeps its store and context.
- **Upload preferences** gain a React context (`UploadPreferencesContext`) wrapping the existing store, so Settings and the convert dialog read and write the same value and re-render together. The `storage` event keeps tabs in step, as Appearance already does.
- **Full-width titles** becomes the existing `fullWidth` upload preference, renamed in the UI to a general "Full-width titles" setting. The rename dialogs read it too.

  Its default changes from off to **on**. The rename dialogs show the full-width field today, and a default of off would hide it from existing users. webminidisc defaults to off.

  A stored `fullWidth: false` from the convert dialog is kept as is.

### 3. Withdrawing consent

A "Withdraw consent" button sets `onlineConsent` to false. The convert dialog already asks whenever consent is false, so nothing else changes.

### 4. Platforms

Both apps render the same dialog and store choices in `localStorage`: per browser profile and site on the web, per OS user in Electron. No USB, filesystem or packaging change.

## Risks / Trade-offs

- **Renaming a familiar control** → the button keeps its position, and the dialog opens on the Appearance section first.
- **The full-width default differs from webminidisc** → recorded here and kept on purpose (decision 2).
