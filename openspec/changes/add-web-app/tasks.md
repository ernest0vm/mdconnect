# Tasks

Prerequisite: `scaffold-desktop-app` is applied and archived.

## 1. Workspace

- [x] 1.1 Create `apps/web/package.json` (`@mdconnect/web`, private, `GPL-2.0-only`, `type: module`, depends on `@mdconnect/app`, `@mdconnect/core`, `@mdconnect/ui`, `react`, `react-dom`; dev `@mdconnect/tsconfig`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `@types/react`, `@types/react-dom`, `@types/w3c-web-usb`) with scripts `dev`, `build`, `preview`, `lint`, `format:check`, `typecheck`, `test`. Add root `dev:web` (`turbo run dev --filter=@mdconnect/web`). Verify with `git diff yarn.lock` that the only addition is the `@mdconnect/web@workspace:apps/web` entry (no new third-party packages), and that the repo-policy tests pass.
- [x] 1.2 Add `tsconfig.json` (extends `react.json`, `types: ["w3c-web-usb", "vite/client"]`), `index.html`, `vite.config.ts` (React + Tailwind plugins, dev server COOP/COEP headers) and `src/styles.css` (`@import "@mdconnect/ui/globals.css"` + `@source` for `packages/ui/src` and `packages/app/src`). Extend the root ESLint browser globals to `apps/web/src/**`. Verify `yarn workspace @mdconnect/web build` writes `apps/web/dist` and `yarn check:affected` runs the web workspace's checks.

## 2. Shared additions in packages

- [x] 2.1 Export `sourceRepositoryUrl`, `licenseName` and `sourceLink(commit)` from `@mdconnect/core`. Tests first: the URL is the GitHub repository, the license is `GPL-2.0`, `sourceLink('abc123')` ends in `/tree/abc123`, and `sourceLink('')` returns the repository root. Define `__MDCONNECT_COMMIT__` in both `apps/web/vite.config.ts` and `apps/desktop/electron.vite.config.ts` as in design.md decision 3.
- [x] 2.2 Add the source/license footer to `@mdconnect/app` (rendered by `App` and by `UnsupportedBrowser`) and the `UnsupportedBrowser` screen (supported browsers list, link to the README's `#download` section, created in 7.1). Verify both render in `yarn dev:web` and in the desktop app (web-delivery: "Source availability", "Supported browsers").
- [x] 2.3 Extend `guidanceFor` in `@mdconnect/app` to take the platform kind (`guidanceFor(kind, os, platformKind)`) and add to `no-device` on the web the "pick the device in the browser's list" hint and a note that mdconnect does not support Hi-MD mode yet, suggesting NetMD mode (no claim that browsers cannot do it, and no desktop-app suggestion, since Hi-MD mode is not supported there either). Tests first: the hint appears for `web` and not for `desktop`; every other kind × OS result is unchanged (usb-device-access: "Web device selection", "Hi-MD mode is not supported on the web yet").
- [x] 2.4 Add an optional `kinds` filter to `usbFilters` in `@mdconnect/core` (default: every kind, so the desktop app is unchanged). `usbFilters` returns one filter per unique vendor/product pair. Tests first: `usbFilters({ kinds: ['netmd'] })` returns 47 filters, including `054c:0187` (listed by both upstream tables), and none of the Hi-MD-only IDs (for example `054c:0287`); `usbFilters()` returns 60 filters (61 table entries, one shared pair). Add `deviceKinds` to `Platform` (desktop entry: every kind; web entry: `['netmd']`) and make the Connect screen request with `usbFilters({ kinds: platform.deviceKinds })`. Tests first with the fake platform: the filters passed to `requestDevice` contain `054c:0287` for a desktop platform and do not for a web platform (usb-device-access: "Web device selection", "Hi-MD mode is not supported on the web yet").

## 3. Web platform

- [x] 3.1 Implement `detectOs()` in `apps/web/src/platform.ts`. Tests first with recorded `userAgentData` and user-agent samples for macOS, Windows, Linux and ChromeOS, plus an unknown value mapping to `other`.
- [x] 3.2 Implement `isWebUsbSupported({ secureContext, hasUsb })`. Tests first: secure + usb → true; insecure or no usb → false.
- [x] 3.3 Implement `webPlatform()` (`kind: 'web'`, `os`, `usb: navigator.usb`, no `deviceChooser`, empty appearance signals) and `src/main.tsx`, which renders `<UnsupportedBrowser>` when unsupported and `<App platform={webPlatform()} />` otherwise, without touching `navigator.usb` on the unsupported path. Verify `yarn typecheck` passes and `yarn dev:web` shows the Connect screen in Chrome.

## 4. Headers, routing and Vercel config

- [x] 4.1 Add `apps/web/vercel.json` with the headers and rewrite from design.md decision 4, `installCommand: "yarn install --immutable"`, `buildCommand: "yarn turbo run build"` and `outputDirectory: "dist"`. Tests first in `test/vercel-config.test.ts`: CSP equals `contentSecurityPolicy` from `@mdconnect/core`; COOP is `same-origin`; COEP is `require-corp`; the `/(.*)` → `/index.html` rewrite exists. Verify the test fails when the CSP in `vercel.json` is edited by one character.
- [ ] 4.2 Write `docs/deployment.md` with the Vercel project settings table from design.md decision 5 and the Corepack fallback. Verify every setting name matches the current Vercel dashboard.

## 5. Vercel project (maintainer, manual)

- [ ] 5.1 The maintainer creates the Vercel project from the GitHub repository with the settings in `docs/deployment.md`. Record the production URL in the README.
- [ ] 5.2 Verify on this change's pull request that a preview deployment is created and its URL is commented. On a test pull request that only touches `apps/desktop`, verify that no web build runs (web-delivery: "Deployments").
- [ ] 5.3 After merge, verify the production URL serves the new version, then check with `curl -I` that the CSP, COOP and COEP headers are present, and that `/device` returns the app rather than a 404 (web-delivery: "Security and isolation headers", "Routing fallback").

## 6. Browser and hardware verification

- [ ] 6.1 Chrome on macOS with a real NetMD device and one non-MiniDisc USB device connected: the chooser lists only the MiniDisc device; choosing it shows name and IDs; closing the chooser (with and without a device listed) shows the "no device found" message with the browser-list hint; reloading shows the device without the chooser; unplugging shows "no device connected" (usb-device-access: "Web device selection", "Web reconnect for granted devices"). In DevTools, `crossOriginIsolated` is `true`.
- [ ] 6.2 Chrome or Edge on Windows: record the behaviour before and after installing the WinUSB driver, and confirm the guidance shown matches the desktop app.
- [ ] 6.3 Chrome on Linux (non-Snap): confirm the udev guidance appears without the rule and the connect succeeds with it.
- [ ] 6.4 Firefox and Safari: the unsupported-browser screen appears with the source footer, and DevTools shows no USB calls.
- [ ] 6.5 Chrome with a Hi-MD device (for example MZ-RH1): in Hi-MD mode the chooser does not offer it and the Connect screen shows the "Hi-MD mode not supported yet" note; switched to NetMD mode, it connects. Record the observed chooser behaviour in `docs/platform-setup.md`.

## 7. Documentation

- [x] 7.1 Update `README.md` with a `## Download` section (how to get the desktop app: build from source with `yarn package` until a release workflow publishes installers, then the GitHub Releases page), the web app URL, supported browsers and `yarn dev:web`. Verify the `UnsupportedBrowser` link resolves to that heading's `#download` anchor on GitHub. Also update `docs/platform-setup.md` with browser notes (secure context, Snap/Flatpak Chrome on Linux). Verify the commands run as written.

## Workflow follow-up

- Archive with `/opsx:archive` after `scaffold-desktop-app` is archived and the verification above is done.
