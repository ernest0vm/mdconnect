# Proposal

## Why

The app follows the OS for light/dark and for reduced transparency, and nothing else. Checking either look means changing system settings, and a user who wants mdconnect dark while the OS is light (or plain opaque panels while the OS keeps transparency) has no way to get it. During hardware verification the maintainer asked for an in-app control.

## What Changes

- An **Appearance** control on every screen (next to the source footer) opens a small dialog with two choices:
  - **Theme**: System (default), Light, Dark.
  - **Transparency**: System (default), Reduced (opaque panels), Glass.
- "System" keeps today's behaviour: follow the OS live, including the desktop app's own reduced-transparency signal.
- The choice is remembered per browser profile on the web and per user on the desktop, and applies at the next launch.
- Same control and behaviour in the desktop app and in the web app, including the web app's unsupported-browser screen.

Out of scope:

- A reduced-motion override (motion keeps following the OS only).
- GlassyUI's rendering quality setting, accent colours or any other theming.
- Syncing the choice between devices or between the desktop and web apps.
- A settings screen; the dialog holds only these two choices.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-theme`: appearance follows the OS unless the user picks a theme or transparency in the app; adds the requirement for the in-app control and for remembering the choice.

## Impact

- `packages/app`: new appearance choice (pure resolution and storage helpers with tests), the dialog and its trigger in the page shell, and `AppearanceBridge` applying the resolved values instead of only the platform signal.
- `packages/ui`: no new component expected; uses `GlassDialog`, `GlassButton` and native radio inputs.
- `apps/desktop`, `apps/web`: no changes; both shells already render the shared screens.
- No new dependencies.
