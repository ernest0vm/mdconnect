# Proposal

## Why

Upstream webminidisc is used mostly as a website: people open a URL in Chrome and manage their MiniDisc without installing anything. mdconnect should keep that path alongside the desktop app, from the same code. `scaffold-desktop-app` puts all behaviour in shared packages (`@mdconnect/core`, `@mdconnect/ui`, `@mdconnect/app`), so a web shell is small. Shipping it early keeps both targets honest: a feature that only works in one shell shows up immediately.

## What Changes

- Add `apps/web` (`@mdconnect/web`): a Vite single-page app that implements the `Platform` interface for browsers and renders `@mdconnect/app`.
- Use the browser's own WebUSB chooser on the web, filtered to supported MiniDisc devices. Devices the user granted before are reconnected without a prompt.
- Show an "unsupported browser" screen when WebUSB is unavailable (Firefox, Safari, non-secure context), naming supported browsers and linking to the desktop app.
- Serve the app with the same Content Security Policy as the desktop app, plus cross-origin isolation headers (COOP/COEP) so later wasm audio encoders can use `SharedArrayBuffer`. Unknown paths fall back to the app.
- Link to the source code and license from the app (GPL-2.0 obligation for distributed JavaScript).
- Deploy on Vercel: production from `main`, a preview deployment for every pull request, and skipped builds when nothing the web app depends on changed.

### Out of scope

- Offline support / PWA install, custom domain, analytics and error reporting.
- Firefox and Safari support (they do not implement WebUSB).
- Any feature beyond what `scaffold-desktop-app` builds (the Connect screen).
- Release automation for desktop installers.

## Capabilities

### New Capabilities

- `web-delivery`: How the web app is served and deployed: supported browsers, security and isolation headers, routing fallback, source availability, and production/preview deployments.

### Modified Capabilities

- `usb-device-access`: adds the web-specific requirements (browser chooser, grants remembered by the browser). The capability is introduced by `scaffold-desktop-app`, which must be archived first; existing requirements are unchanged.

## Impact

- New workspace `apps/web` (`@mdconnect/web`) depending on `@mdconnect/app`, `@mdconnect/core` and `@mdconnect/ui`. No new runtime dependencies; dev dependencies (`vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`) are already in the repo from `scaffold-desktop-app`.
- New `apps/web/vercel.json`. A Vercel project must be created and connected to the GitHub repository by the maintainer (Root Directory `apps/web`; Yarn 4 runs from the committed release, without Corepack).
- Root `dev` script gains a web variant (`dev:web`).
- Depends on `scaffold-desktop-app` being applied first.
