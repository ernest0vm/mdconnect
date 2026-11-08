# Design

## Context

See proposal.md for motivation. Relevant current state:

- Root tooling exists: Yarn 4 workspaces (`node-modules` linker, 7-day `npmMinimalAgeGate`, dependency install scripts disabled), Turborepo with `--affected` checks, TypeScript 6.0 strict, ESLint (typescript-eslint `strictTypeChecked`), Prettier, Vitest 5, husky + lint-staged. Shared tsconfig bases live in `@mdconnect/tsconfig` (`node.json`, `react.json`, `library.json`). `@mdconnect/repo-policy` enforces that every workspace with a `tsconfig.json` defines `lint`, `format:check`, `typecheck` and `test`, depends on `@mdconnect/tsconfig`, and declares no `dependenciesMeta`.
- Upstream webminidisc is a Vite + React + TypeScript web app using MUI. Its protocol libraries `netmd-js` 4.4.1 and `himd-js` 0.2.15 are TypeScript, but their npm packages depend on the native `usb` module, `bunyan`, `yargs` and a GitHub-hosted `crypto-js-wasm`. Integrating them is a separate change; this one only copies their USB device ID tables.
- mdconnect ships a desktop app (this change) and a web app (`add-web-app`) from the same code. Most behaviour is identical. The differences are in how a USB device is chosen and granted, how appearance preferences are read, which security headers are set and by whom, and packaging.
- Electron's WebUSB does not show Chrome's device chooser. The main process must handle `select-usb-device` and grant permissions through session handlers. In a browser, Chrome shows its own chooser and remembers grants per origin.
- Hi-MD devices in Hi-MD mode present the USB mass-storage class, which Chromium blocks for WebUSB by default.

## Goals / Non-Goals

**Goals:**

- One place for each piece of behaviour: platform-agnostic logic in `@mdconnect/core`, UI primitives in `@mdconnect/ui`, screens in `@mdconnect/app`. App shells contain only what is specific to their runtime.
- A secure Electron shell whose main, preload and renderer code all pass `yarn check`, with fast HMR in development.
- WebUSB that works the same way on macOS, Windows and Linux once OS-level access is in place, with the desktop main process as the only place that decides which devices are reachable.
- Pure, unit-tested modules for the logic that can break silently: the device table, device selection, error classification, OS guidance, appearance resolution and the protocol handler's path guard.

**Non-Goals:**

- The web shell. `add-web-app` adds `apps/web` and its `Platform` implementation on top of these packages.
- Automated end-to-end UI tests (Playwright). The connect screen is verified manually on hardware in this change.
- Component tests with a DOM (jsdom, Testing Library). Logic is extracted into pure functions and tested there. DOM testing can be added when screens grow beyond the walking skeleton.
- Calling `setUSBProtectedClassesHandler` to unblock mass storage for Hi-MD. This is decided with the Hi-MD integration change.
- Cross-compiling installers for other OSes from one machine.

## Decisions

### 1. Workspace layout and dependency direction

```
packages/core   @mdconnect/core   pure TS: devices, USB filters, selection, error kinds
packages/ui     @mdconnect/ui     shadcn + GlassyUI components, globals.css, theme helpers
packages/app    @mdconnect/app    React screens + feature logic, Platform interface
apps/desktop    @mdconnect/desktop  Electron main/preload + renderer entry
apps/web        @mdconnect/web      (add-web-app) Vite SPA entry
```

Dependencies only point downward: `apps/* → app → ui, core`. `ui` and `core` do not depend on each other or on `app`. `core` has no React or Node imports. Its base, `@mdconnect/tsconfig/library.json`, changes from `lib: ["ES2023", "DOM"]` to `["ES2023", "WebWorker"]`: that still provides `DOMException` and the WebUSB navigator types, but `document` and `window` fail to compile, so the protocol work can later run in a worker or a test without a DOM. A lint rule (`no-restricted-imports`) enforces the direction: `core` may not import `react`, `node:*` or other workspaces; `ui` may not import `@mdconnect/app` or `@mdconnect/core`.

- Alternative: **everything inside `apps/desktop` first, extract later**. Rejected: the web app is a confirmed target, and extracting after code exists means moving files, rewriting imports and re-splitting tests.
- Alternative: **separate repositories for core/ui**. Rejected: it slows every cross-cutting change and duplicates the harness. Turborepo `--affected` already gives per-package checks.

### 2. Internal packages consumed as source

Shared packages export TypeScript source directly. `core` and `app` export a barrel (`"exports": { ".": "./src/index.ts" }`). `ui` follows shadcn's monorepo layout with explicit per-folder patterns, because export targets are not extension-probed: `"./components/*": "./src/components/*.tsx"`, `"./lib/*": "./src/lib/*.ts"`, `"./theme": "./src/theme.ts"`, `"./globals.css": "./src/styles/globals.css"`. Consumers' bundlers compile them: Vite in the renderer, and electron-vite for main/preload. Shared packages therefore have no `build` script. `typecheck`, `lint` and `test` run per package, and turbo's `^build` dependency is a no-op for them.

- electron-vite externalizes dependencies for main and preload by default. `@mdconnect/core` must be excluded from that so the workspace source is bundled instead of `require`-d as `.ts` at runtime. Earlier majors did this with `externalizeDepsPlugin({ exclude })`; task 2.3 uses whatever electron-vite 6 documents for it.
- Alternative: **compiled packages (`tsc` → `dist`)**. Rejected for now. It adds build ordering, watch mode and `.d.ts` drift for no benefit while every consumer is a bundler. It can be revisited if a package is ever published.

### 3. The `Platform` interface

`@mdconnect/app` defines what a shell must provide and never touches Electron or browser-detection APIs directly:

```ts
export interface Platform {
  readonly kind: 'desktop' | 'web';
  readonly os: 'macos' | 'windows' | 'linux' | 'chromeos' | 'other';
  readonly usb: USB; // navigator.usb, injected so tests can fake it
  /** Desktop only: the in-app chooser bridge. On the web, the browser shows its own chooser. */
  readonly deviceChooser?: {
    onChooseDevice(cb: (req: ChooseDeviceRequest) => void): () => void;
    respond(requestId: string, deviceId: string | null): void;
  };
  readonly appearance: {
    get(): AppearanceSignals; // { prefersReducedTransparency?: boolean }
    onChange(cb: (s: AppearanceSignals) => void): () => void;
  };
}
```

Each shell's entry builds its `Platform` and renders `<App platform={platform} />`. The desktop implementation wraps `window.mdconnect` (decision 7). `packages/app/src/testing/fake-platform.ts` provides a fake for unit tests.

### 4. Build the desktop app with electron-vite, package with electron-builder

`electron-vite` builds main, preload and renderer from one `electron.vite.config.ts`, with renderer HMR and main/preload hot restart. `electron-builder` turns the output into `.dmg`, NSIS `.exe`, AppImage and `.deb` from one `electron-builder.yml`, and can flip Electron fuses at package time.

- Alternative: **Electron Forge** with its Vite plugin. It covers build and packaging in one tool, but needs one Vite config per process and its plugin has historically trailed Vite releases. Rejected for now. Both tools are MIT, and moving to Forge later would only touch build config.
- Alternative: **hand-rolled Vite configs + scripts**. Rejected: it rebuilds what electron-vite already does (externalizing Node built-ins, preload format, dev-server URL injection).

### 5. File structure

```
packages/core/src/
  devices.ts              NetMD + Hi-MD ID table (GPL attribution header), findDevice, usbFilters
  device-selection.ts     chooseDevice(list) -> none | auto(id) | ask(list)
  usb-errors.ts           classifyUsbError(error, phase) -> no-device | cancelled | access-denied | unknown
packages/ui/
  components.json         shadcn (monorepo: aliases @mdconnect/ui/components, .../lib/utils)
  src/components/         shadcn + GlassyUI generated source
  src/lib/utils.ts
  src/styles/globals.css  Tailwind 4 + GlassyUI liquid.css (reduced motion and transparency)
  src/theme.ts            resolveReducedTransparency + syncColorSchemeClass
packages/app/src/
  platform.ts             Platform interface + shared types
  App.tsx                 root: theme wiring, screen routing
  features/connect/       Connect screen, chooser dialog, guidanceFor(kind, os)
  testing/fake-platform.ts
apps/desktop/
  electron.vite.config.ts, electron-builder.yml
  resources/linux/60-mdconnect.rules
  src/shared/ipc.ts       channel names + payload types (main <-> preload only)
  src/main/               index.ts, security.ts, app-protocol.ts, usb.ts
  src/preload/index.ts    contextBridge: window.mdconnect
  src/renderer/           index.html, main.tsx (desktopPlatform + <App/>), styles.css
```

Each shared package's `tsconfig.json` extends the matching base (`core` → `library.json`, `ui`/`app` → `react.json` with `w3c-web-usb` types for `app`). In `apps/desktop`, `tsconfig.json` is a solution file referencing `tsconfig.node.json` (main, preload, shared, config files; extends `node.json`) and `tsconfig.web.json` (renderer; extends `react.json`). Its `typecheck` runs `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit`, because `tsc -p` on a solution file checks none of its references.

### 6. Secure desktop origin and window hardening

In packaged builds the renderer loads `app://mdconnect/index.html`. `app` is registered with `protocol.registerSchemesAsPrivileged` (`standard`, `secure`, `supportFetchAPI`, `codeCache`) and served by `protocol.handle`. The handler resolves paths only inside the bundled renderer directory. Any path that normalizes outside it, or does not exist, returns 404. In development the renderer loads the Vite dev server URL that electron-vite provides. `isAppOrigin(origin)` accepts `app://mdconnect` always and the dev-server origin only when `!app.isPackaged`.

- Why not `file://`: the origin is opaque (`file://` / `null`), so permission handlers cannot scope USB to "our" origin, and the CSP cannot be sent as a response header.
- The handler can later add `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers, which the ported wasm audio encoders need for `SharedArrayBuffer`. The web app sets the same headers through Vercel.

Hardening:

- `BrowserWindow` `webPreferences`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, `webviewTag: false`. `app.enableSandbox()` is called before ready.
- `will-navigate` and `will-redirect` are prevented. `setWindowOpenHandler` returns `deny` and calls `shell.openExternal` only for `http:` / `https:` URLs.
- `setPermissionRequestHandler` denies everything (USB uses the device-permission path in decision 7, not this one).
- CSP is sent as a response header by the `app://` handler: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. `style-src 'unsafe-inline'` is needed because Radix and GlassyUI set inline `style` attributes. In development a relaxed CSP is applied through `session.webRequest.onHeadersReceived`, allowing the Vite client and React Refresh preamble. The CSP string lives in `@mdconnect/core` (`contentSecurityPolicy`) so the web app sends exactly the same policy.
- Electron fuses are set at package time: `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on, `GrantFileProtocolExtraPrivileges` off (the renderer never uses `file://`).
- `app.requestSingleInstanceLock()`. A second instance quits. The first restores and focuses its main window, or creates one if none exists (macOS after the window was closed). This also prevents two processes from fighting over the same USB device.

### 7. Desktop USB access is decided in the main process

All on `session.defaultSession`:

- `setPermissionCheckHandler`: returns `true` for `usb` only when `isAppOrigin(requestingOrigin)`, `false` for every other permission.
- `setDevicePermissionHandler`: returns `true` when `deviceType === 'usb'`, the origin is the app origin, and `isSupportedDevice(vendorId, productId)` from `@mdconnect/core`. This is why connected known devices are listable through `navigator.usb.getDevices()` at launch without a prompt, and why `navigator.usb` `connect`/`disconnect` events reach the renderer.
- `select-usb-device`: `event.preventDefault()`, filter `details.deviceList` through the device table, then call `chooseDevice` from `@mdconnect/core`:
  - `none` → `callback()` (renderer gets `NotFoundError`).
  - `auto` → `callback(deviceId)`.
  - `ask` → send `usb:choose-device` with `{ requestId, devices: [{ deviceId, name, vendorId, productId, serialNumber }] }` to the window. Wait for `usb:device-chosen` with `{ requestId, deviceId | null }`, then `callback(deviceId ?? undefined)`. Only one pending request is kept. A new request, a renderer reload or the window closing resolves the old one as cancelled.

The renderer calls `platform.usb.requestDevice({ filters: usbFilters() })`, with filters built from the same table, so Chromium's own filtering and the main-process check agree.

The preload exposes only the following. Every value crossing the bridge is serializable, except that subscription functions take a callback and return an unsubscribe function.

```ts
window.mdconnect = {
  os: 'macos' | 'windows' | 'linux',
  usb: {
    onChooseDevice(cb: (req: ChooseDeviceRequest) => void): () => void,
    respondChooseDevice(requestId: string, deviceId: string | null): void,
  },
  appearance: {
    get(): AppearanceSignals,
    onChange(cb: (s: AppearanceSignals) => void): () => void,
  },
};
```

`apps/desktop/src/renderer/main.tsx` adapts this to `Platform` (`kind: 'desktop'`, `usb: navigator.usb`, `deviceChooser` from `window.mdconnect.usb`). Payloads are validated in the main process against the pending `requestId` and the offered `deviceId`s before being trusted.

- Alternative: **node `usb` (libusb) in the main process with IPC to the renderer**, which is what netmd-js does under Node. Rejected for this change: it needs a native module (install scripts, per-OS prebuilds, rebuilds per Electron version), duplicates WebUSB, and would not exist on the web. It remains the desktop fallback if WebUSB proves unworkable on Windows.

### 8. Device table copied, not imported

`packages/core/src/devices.ts` contains the NetMD list from `netmd-js` 4.4.1 (`DevicesIds`, 47 entries) and the Hi-MD list from `himd-js` 0.2.15 (14 entries), each entry `{ vendorId, productId, name, kind: 'netmd' | 'himd' }`, under a GPL-2.0 header crediting both projects. Importing the packages only for these tables would pull in `usb`, `bunyan` and `yargs`. One ID pair is in both lists (`054c:0187`: NetMD "Sony MZ-NH600D", Hi-MD "Sony MZ-NH600"). The table keeps both entries, and name lookup returns the NetMD name for it. The protocol-integration change will switch to the packages' own exports if they become dependencies anyway.

### 9. Failure kinds and OS guidance

`classifyUsbError(error, phase)` in `@mdconnect/core` maps `DOMException` names to `no-device` (`NotFoundError` from `requestDevice`), `cancelled` (`NotFoundError` after a chooser cancel, tracked via the chooser result), `access-denied` (`SecurityError` / `NetworkError` from `open()`), or `unknown`. `guidanceFor(kind, os)` in `@mdconnect/app` maps the result to the message and link required by the spec. It works the same in both apps, because `os` comes from `Platform`. Links open the community setup guide (`https://www.minidisc.wiki/guides/webminidisc/requirements#windows` / `#linux`), which upstream webminidisc also points to. `docs/platform-setup.md` holds the same steps for contributors, plus what this project verified on hardware. Both functions are pure and unit-tested.

### 10. UI foundation (`@mdconnect/ui`)

- React 19, Tailwind CSS 4. shadcn/ui follows its monorepo layout: `packages/ui/components.json` owns the components (aliases `@mdconnect/ui/components`, `@mdconnect/ui/lib/utils`, `tailwind.css: src/styles/globals.css`, empty `tailwind.config` for v4), with a `@mdconnect/ui/*` path alias so the CLI resolves them. `shadcn init` needs a framework to detect and `--monorepo` scaffolds a new repository, so the config is written by hand with the same shape.
- GlassyUI components come from its registry through `yarn dlx shadcn@4.23.0 add @glassyui/<component>` (pinned, older than 7 days; the CLI is not a project dependency). They land in `src/components/glassyui/` with their own `lib/` and `styles/liquid.css`. The generated source is reviewed (no network access or `eval`; it only uses `localStorage` for its own preferences) and fixed to pass strict TypeScript and lint without disabling rules.
- Each app's stylesheet does `@import "@mdconnect/ui/globals.css"` and declares `@source` for `packages/ui/src` and `packages/app/src`. Tailwind 4 skips workspace packages that resolve through `node_modules`, so their classes would be missing without these declarations.
- Theme and accessibility reuse GlassyUI: `GlassProvider` follows `prefers-color-scheme`, `prefers-reduced-motion` and `prefers-reduced-transparency` live, and its `liquid.css` makes glass opaque under `data-lg-reduce-transparency` and stops animations under `data-lg-reduce-motion`. `@mdconnect/ui/theme` adds only what GlassyUI cannot know: `resolveReducedTransparency(platformSignal, mediaQuery)` ORs the desktop's `nativeTheme` signal with the media query, and `syncColorSchemeClass` keeps Tailwind's `dark` class in step with the active theme. `AppearanceBridge` in `@mdconnect/app` feeds the platform signal to GlassyUI with `setPreferences`. On Linux desktops that expose no reduced-transparency preference, the default glass look is used, as the ui-theme spec states. Desktop main sets `nativeTheme.themeSource = 'system'` and forwards `nativeTheme` `updated` events.

### 11. Lint and monorepo wiring

- Root `eslint.config.mjs` gains `eslint-plugin-react-hooks` (recommended) for `**/*.tsx`, `globals.browser` for `packages/{ui,app}/**` and `apps/desktop/src/{renderer,preload}/**`, and the `no-restricted-imports` boundaries from decision 1. Generated `components/**` stays linted. Generated code that violates strict rules is fixed when it is added, not ignored.
- `apps/desktop` lists every package as a `devDependency` and pins `electron` exactly (`44.10.1`): main, preload and renderer are fully bundled, so the installer ships no `node_modules`, and electron-builder needs an exact Electron version. `electron-builder.yml` sets `publish: null` (no update feeds yet) and `resetAdHocDarwinSignature: true`, because flipping fuses invalidates Electron's ad-hoc signature and macOS on Apple Silicon kills an unsigned binary on launch.
- Scripts: shared packages define `lint`, `format:check`, `typecheck`, `test`. `apps/desktop` adds `dev` (electron-vite dev), `build` (electron-vite build) and `package` (build + electron-builder for the current OS). Root forwards `dev` and `package` to the desktop app with `turbo run <task> --filter=@mdconnect/desktop`. Turbo gains an uncached `package` task with `release/**` outputs.
- No package is opted in to install scripts. Electron 44 has no `postinstall`: `require('electron')` downloads the binary on first use and verifies it against `checksums.json`. electron-vite looks for the binary without triggering that download, so the desktop `dev` script runs `scripts/ensure-electron.mjs` first (found when `yarn dev` failed with "Electron uninstall" on a clean clone). If a tool ever fails without its script, the task opts that package in via root `dependenciesMeta` (Yarn ignores it in workspace manifests, and `@mdconnect/repo-policy` rejects it there) and records the reason in the policy test allowlist.

### Dependencies

All versions are the newest that pass the 7-day gate at implementation time. Majors as of 2026-11-08:

| Package                                                           | Where                    | Kind    | Purpose                                       | License   | Status                        |
| ----------------------------------------------------------------- | ------------------------ | ------- | --------------------------------------------- | --------- | ----------------------------- |
| `react`, `react-dom` 19.x                                         | app, ui (peer); desktop  | runtime | UI                                            | MIT       | Active                        |
| `@radix-ui/react-slot` 1.x, `@radix-ui/react-dialog` 1.x          | ui                       | runtime | Primitives under GlassyUI's button and dialog | MIT       | Active                        |
| `clsx` 2.x, `tailwind-merge` 3.x                                  | ui                       | runtime | Class helpers (`cn`)                          | MIT / MIT | Stable / active               |
| `tw-animate-css` 1.x                                              | ui                       | dev     | shadcn animation utilities (CSS only)         | MIT       | Stable                        |
| `tailwindcss` 4.x, `@tailwindcss/vite` 4.x                        | ui (peer); desktop       | dev     | Styling                                       | MIT       | Active                        |
| `electron` 44.x                                                   | desktop                  | dev     | Runtime (45.x is still inside the 7-day gate) | MIT       | Active, release every 8 weeks |
| `electron-vite` 6.x                                               | desktop                  | dev     | Build main/preload/renderer, HMR              | MIT       | Active (6.0.0, Oct 2026)      |
| `vite` 8.x, `@vitejs/plugin-react` 6.x                            | desktop                  | dev     | Renderer bundler, React transform             | MIT       | Active                        |
| `electron-builder` 26.x                                           | desktop                  | dev     | Installers, fuses                             | MIT       | Active (Oct 2026)             |
| `vitest` 5.x                                                      | every package with tests | dev     | Unit tests (already used by repo-policy)      | MIT       | Active                        |
| `@types/react`, `@types/react-dom` 19.x, `@types/w3c-web-usb` 1.x | ui, app, core, desktop   | dev     | Types                                         | MIT       | Active                        |
| `eslint-plugin-react-hooks` 7.x                                   | root                     | dev     | Hooks lint rules                              | MIT       | Active (React team)           |

Every runtime dependency in `ui` is required by the GlassyUI components in use. `class-variance-authority` and `lucide-react`, planned earlier, are not needed by them and were not added; add them only with a component that uses them. `core` has no runtime dependencies.

### Platform behaviour (USB, packaging)

|                | macOS                                                                                       | Windows                                                                                                                                                                                                                                                                | Linux                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebUSB access  | Works without setup. NetMD uses a vendor-specific interface, so no kernel driver claims it. | Chromium WebUSB needs the device bound to the WinUSB driver. MiniDisc devices do not request it, so a driver must be installed (today: Zadig). Expected: without the driver the device is either not listed or `open()` fails, which maps to `access-denied` guidance. | The user needs read/write access to the USB device node. `resources/linux/60-mdconnect.rules` grants it with `TAG+="uaccess"` per vendor/product pair from the device table. A unit test fails if the rules file and the table drift apart. |
| Package        | `.dmg`, unsigned (Gatekeeper requires right-click → Open)                                   | NSIS `.exe`, unsigned (SmartScreen warning)                                                                                                                                                                                                                            | AppImage + `.deb`. The rules file is shipped inside the app's resources but not installed.                                                                                                                                                  |
| Setup guidance | In-app hint only                                                                            | In-app link to minidisc.wiki `#windows`; `docs/platform-setup.md#windows`                                                                                                                                                                                              | In-app link to minidisc.wiki `#linux`; `docs/platform-setup.md#linux` with the bundled rules file                                                                                                                                           |

The same OS requirements apply to the web app in Chromium-based browsers. `add-web-app` covers how they are presented there.

## Risks / Trade-offs

- [Windows needs a manual driver install, so the desktop app is not plug-and-play there yet] → Document it, show guidance in-app, verify behaviour on real hardware in this change, and plan a follow-up change for installer-driven driver setup (libwdi) or the node `usb` fallback.
- [Source-consumed packages couple every consumer to the same TS and bundler settings] → All consumers already share `@mdconnect/tsconfig` and Vite. If a package must ever be published or run unbundled, add a build step to that package only.
- [Package boundaries erode over time] → `no-restricted-imports` rules fail lint on wrong-direction imports, and `CLAUDE.md` plus `openspec/config.yaml` state where code belongs.
- [Electron downloads its binary from GitHub on first run, outside the npm age gate] → The download is checksum-verified against the npm package's `checksums.json`, which did pass the age gate. No package runs install scripts.
- [electron-builder downloads NSIS/AppImage tooling from GitHub at package time, also outside the age gate] → Acceptable for unsigned local builds. Revisit pinning or caching when release CI is set up.
- [GlassyUI is a young, single-maintainer registry] → Its components are copied into the repo as source, so there is no runtime dependency on the project continuing. We own and can edit the code.
- [`style-src 'unsafe-inline'` weakens the CSP] → Scripts stay strictly `'self'` and the renderer has no Node access, so inline styles cannot escalate to code execution.
- [`setDevicePermissionHandler` auto-grants every known MiniDisc device without user consent] → Only the app's own origin can use it, the list is limited to MiniDisc hardware, and this matches what a user expects from a MiniDisc manager. Revisit if remote content is ever loaded.
- [Two devices sharing an ID across NetMD and Hi-MD lists] → Kept explicit in the table and covered by a unit test.

## Migration Plan

Not applicable: no existing app or users. Rollback is reverting the change.

## Open Questions

- Exact Windows behaviour without WinUSB (device hidden vs. `open()` failing). It is recorded during manual testing and only changes the wording in the docs.
- Final app ID, product name and icon for installers. `mdconnect` / `org.mdconnect.desktop` and Electron's default icon are placeholders.
- Which Linux desktops report a reduced-transparency preference through either signal. This only changes the documentation of supported desktops, not the behaviour.
