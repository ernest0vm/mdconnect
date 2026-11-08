# Design

## Context

See proposal.md for motivation. Relevant current state:

- Root tooling exists: Yarn 4 workspaces (`node-modules` linker, 7-day `npmMinimalAgeGate`, dependency install scripts disabled), Turborepo, TypeScript 6.0 strict, ESLint (typescript-eslint `strictTypeChecked`), Prettier, husky + lint-staged. Shared tsconfig bases live in `@mdconnect/tsconfig` (`node.json`, `react.json`, `library.json`).
- Upstream webminidisc is a Vite + React + TypeScript web app using MUI. Its protocol libraries `netmd-js` 4.4.1 and `himd-js` 0.2.15 are TypeScript, but their npm packages depend on the native `usb` module, `bunyan`, `yargs` and a GitHub-hosted `crypto-js-wasm`. Integrating them is a separate change; this one only copies their USB device ID tables.
- Electron's WebUSB does not show Chrome's device chooser. The main process must handle `select-usb-device` and grant permissions through session handlers.
- Hi-MD devices in Hi-MD mode present the USB mass-storage class, which Chromium blocks for WebUSB by default.

## Goals / Non-Goals

**Goals:**

- A secure Electron shell whose main, preload and renderer code all pass `yarn check`, with fast HMR in development.
- WebUSB that works the same way on macOS, Windows and Linux once OS-level access is in place, with the main process as the only place that decides which devices are reachable.
- A UI base (Tailwind 4, shadcn/ui, GlassyUI) that later webminidisc screens can be ported onto.
- Pure, unit-tested modules for the logic that can break silently: the device table, device selection, error classification and the protocol handler's path guard.

**Non-Goals:**

- Automated end-to-end UI tests (Playwright for Electron). The connect screen is verified manually on hardware in this change.
- Calling `setUSBProtectedClassesHandler` to unblock mass storage for Hi-MD. This is decided with the Hi-MD integration change.
- Cross-compiling installers for other OSes from one machine.

## Decisions

### 1. Build with electron-vite, package with electron-builder

`electron-vite` builds main, preload and renderer from one `electron.vite.config.ts`, with renderer HMR and main/preload hot restart. `electron-builder` turns the output into `.dmg`, NSIS `.exe`, AppImage and `.deb` from one `electron-builder.yml`, and can flip Electron fuses at package time.

- Alternative: **Electron Forge** with its Vite plugin. It covers build and packaging in one tool, but needs one Vite config per process and its plugin has historically trailed Vite releases. Rejected for now. Both tools are MIT and moving to Forge later would only touch build config.
- Alternative: **hand-rolled Vite configs + scripts**. Rejected: it rebuilds what electron-vite already does (externalizing Node built-ins, preload format, dev-server URL injection).

### 2. Process layout and file structure

```
apps/desktop/
  electron.vite.config.ts
  electron-builder.yml
  components.json                  # shadcn config
  resources/linux/60-mdconnect.rules
  src/
    shared/                        # pure TS, no Node or DOM APIs; used by main and renderer
      devices.ts                   # NetMD + Hi-MD ID table (GPL attribution header)
      device-selection.ts          # chooseDevice(list) -> auto | ask | none
      ipc.ts                       # channel names + payload types
    main/
      index.ts                     # app lifecycle, single-instance lock, window
      security.ts                  # window hardening, navigation lock, CSP
      app-protocol.ts              # app:// handler + path guard
      usb.ts                       # session USB handlers, chooser bridge
    preload/index.ts               # contextBridge: window.mdconnect
    renderer/
      index.html, main.tsx, App.tsx
      components/ui/               # shadcn + GlassyUI generated source
      features/connect/            # Connect screen, error -> message mapping
      lib/theme.ts                 # OS appearance -> data attributes
```

`tsconfig.json` in the app is a solution file referencing `tsconfig.node.json` (main, preload, shared, config files; extends `@mdconnect/tsconfig/node.json`) and `tsconfig.web.json` (renderer, shared; extends `react.json`, adds `w3c-web-usb` types and the `@/*` alias shadcn expects). `typecheck` runs `tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit`.

### 3. Secure app origin via a privileged custom scheme

In packaged builds the renderer loads `app://mdconnect/index.html`. `app` is registered with `protocol.registerSchemesAsPrivileged` (`standard`, `secure`, `supportFetchAPI`, `codeCache`) and served by `protocol.handle`. The handler resolves paths only inside the bundled renderer directory. Any path that normalizes outside it, or does not exist, returns 404. In development the renderer loads the Vite dev server URL that electron-vite provides.

- Why not `file://`: the origin is opaque (`file://` / `null`), so permission handlers cannot scope USB to "our" origin, and the CSP cannot be sent as a response header.
- Bonus: the handler can later add `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers, which the ported wasm audio encoders need for `SharedArrayBuffer`.

`isAppOrigin(origin)` accepts `app://mdconnect` always and the dev-server origin only when `!app.isPackaged`.

### 4. Window and session hardening

- `BrowserWindow` `webPreferences`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, `webviewTag: false`. `app.enableSandbox()` is called before ready.
- `will-navigate` and `will-redirect` are prevented. `setWindowOpenHandler` returns `deny` and calls `shell.openExternal` only for `http:` / `https:` URLs.
- `setPermissionRequestHandler` denies everything (USB uses the device-permission path below, not this one).
- CSP is sent as a response header by the `app://` handler: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. `style-src 'unsafe-inline'` is needed because Radix and GlassyUI set inline `style` attributes. In development a relaxed CSP is applied through `session.webRequest.onHeadersReceived`, allowing the Vite client and React Refresh preamble.
- Electron fuses are set at package time: `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on.
- `app.requestSingleInstanceLock()`. A second instance quits and the first restores and focuses its window. This also prevents two processes from fighting over the same USB device.

### 5. USB access is decided in the main process

All on `session.defaultSession`:

- `setPermissionCheckHandler`: returns `true` for `usb` only when `isAppOrigin(requestingOrigin)`, `false` for every other permission.
- `setDevicePermissionHandler`: returns `true` when `deviceType === 'usb'`, the origin is the app origin, and `(vendorId, productId)` is in the device table. This is why connected known devices are listable through `navigator.usb.getDevices()` at launch without a prompt, and why `navigator.usb` `connect`/`disconnect` events reach the renderer.
- `select-usb-device`: `event.preventDefault()`, filter `details.deviceList` through the device table, then call the pure `chooseDevice`:
  - `none` → `callback()` (renderer gets `NotFoundError`).
  - `auto` → `callback(deviceId)`.
  - `ask` → send `usb:choose-device` with `{ requestId, devices: [{ deviceId, name, vendorId, productId, serialNumber }] }` to the window. Wait for `usb:device-chosen` with `{ requestId, deviceId | null }`, then `callback(deviceId ?? undefined)`. Only one pending request is kept. A new request, a renderer reload or the window closing resolves the old one as cancelled.

The renderer calls `navigator.usb.requestDevice({ filters })`, with filters built from the same table, so Chromium's own filtering and the main-process check agree.

The preload exposes only:

```ts
window.mdconnect = {
  platform: 'darwin' | 'win32' | 'linux',
  usb: {
    onChooseDevice(cb: (req: ChooseDeviceRequest) => void): () => void,
    respondChooseDevice(requestId: string, deviceId: string | null): void,
  },
  appearance: {
    get(): AppearanceState,                                 // { reducedTransparency }
    onChange(cb: (s: AppearanceState) => void): () => void,
  },
};
```

Payloads are validated in the main process against the pending `requestId` and the offered `deviceId`s before being trusted.

- Alternative: **node `usb` (libusb) in the main process with IPC to the renderer**, which is what netmd-js does under Node. Rejected for this change: it needs a native module (install scripts, per-OS prebuilds, rebuilds per Electron version) and duplicates WebUSB, which upstream code already targets. It remains the fallback if WebUSB proves unworkable on Windows.

### 6. Device table copied, not imported

`src/shared/devices.ts` contains the NetMD list from `netmd-js` 4.4.1 (`DevicesIds`, 47 entries) and the Hi-MD list from `himd-js` 0.2.15 (14 entries), each entry `{ vendorId, productId, name, kind: 'netmd' | 'himd' }`, under a GPL-2.0 header crediting both projects. Importing the packages only for these tables would pull in `usb`, `bunyan` and `yargs`. One ID pair is in both lists (`054c:0187`: NetMD "Sony MZ-NH600D", Hi-MD "Sony MZ-NH600"). The table keeps both entries, and name lookup returns the NetMD name for it. The protocol-integration change will switch to the packages' own exports if they become dependencies anyway.

### 7. Failure kinds and OS guidance

`classifyUsbError(error, phase)` maps `DOMException` names to `no-device` (`NotFoundError` from `requestDevice`), `cancelled` (`NotFoundError` after a chooser cancel, tracked via the chooser result), `access-denied` (`SecurityError` / `NetworkError` from `open()`), or `unknown`. The connect screen maps `(kind, platform)` to the message and the link required by the spec. Links open the community setup guide in the default browser (`https://www.minidisc.wiki/guides/webminidisc/requirements#windows` / `#linux`), which upstream webminidisc also points to and which stays reachable from an installed app. `docs/platform-setup.md` holds the same steps for contributors, plus what this project verified on hardware. Both functions are pure and unit-tested.

### 8. UI foundation

- React 19, Tailwind CSS 4 via `@tailwindcss/vite` (no PostCSS config), shadcn/ui initialized with `components.json` (`rsc: false`, `tsx: true`, alias `@/`).
- GlassyUI components are added with the shadcn CLI from its registry (`@glassyui/<component>`), which writes source into `components/ui/glassyui`. The CLI is run through `yarn dlx shadcn@4.23.0` (pinned, older than 7 days) and is not a project dependency. Initial set: Surface, Panel, Button, Dialog, Spinner, Alert, Badge.
- Theme: `nativeTheme.themeSource = 'system'`. The renderer sets `data-lg-theme` (GlassyUI) and the `dark` class (shadcn) from `matchMedia('(prefers-color-scheme: dark)')` and updates them on change. Reduced motion uses the CSS `prefers-reduced-motion` media query. Reduced transparency is on when either signal reports it: Electron's `nativeTheme.prefersReducedTransparency` (forwarded through the preload) or Chromium's `prefers-reduced-transparency: reduce` media query. Neither is reliable on every platform, so the renderer ORs them. The result sets `data-reduced-transparency` on `<html>`, and CSS overrides make glass surfaces opaque and remove `backdrop-filter`. On Linux, many desktops expose no such preference; there the default glass look is used, as the ui-theme spec states, and task 7.3 records what each tested desktop reports.

### 9. Lint and monorepo wiring

- Root `eslint.config.mjs` gains `eslint-plugin-react-hooks` (recommended) for `**/*.tsx`, and `globals.browser` for `apps/desktop/src/{renderer,preload}/**`. `components/ui/**` (generated) stays linted. Generated code that violates strict rules is fixed when it is added, not ignored.
- `apps/desktop/package.json` scripts: `dev` (electron-vite dev), `build` (electron-vite build), `typecheck`, `test` (vitest run), `package` (build + electron-builder for the current OS). Turbo gains an uncached `package` task with `release/**` outputs.
- `dependenciesMeta.electron.built: true` in the **root** `package.json` (Yarn ignores `dependenciesMeta` in workspace manifests, and `@mdconnect/repo-policy` rejects it there) lets Electron's postinstall download its binary. No other package is opted in. If `esbuild` or another tool fails without its script, the task records it and opts that package in explicitly.

### Dependencies

All versions are the newest that pass the 7-day gate at implementation time. Majors as of 2026-11-08:

| Package                                                              | Kind    | Purpose                                       | License                | Status                                                        |
| -------------------------------------------------------------------- | ------- | --------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| `electron` 44.x                                                      | dev     | Runtime (45.x is still inside the 7-day gate) | MIT                    | Active, release every 8 weeks                                 |
| `electron-vite` 6.x                                                  | dev     | Build main/preload/renderer, HMR              | MIT                    | Active (6.0.0, Oct 2026)                                      |
| `vite` 8.x, `@vitejs/plugin-react` 6.x                               | dev     | Renderer bundler, React transform             | MIT                    | Active                                                        |
| `electron-builder` 26.x                                              | dev     | Installers, fuses                             | MIT                    | Active (Oct 2026)                                             |
| `tailwindcss` 4.x, `@tailwindcss/vite` 4.x                           | dev     | Styling                                       | MIT                    | Active                                                        |
| `vitest` 4.x                                                         | dev     | Unit tests (5.x still inside the 7-day gate)  | MIT                    | Active                                                        |
| `@types/react`, `@types/react-dom` 19.x, `@types/w3c-web-usb` 1.x    | dev     | Types                                         | MIT                    | Active                                                        |
| `eslint-plugin-react-hooks` 7.x                                      | dev     | Hooks lint rules                              | MIT                    | Active (React team)                                           |
| `react`, `react-dom` 19.x                                            | runtime | UI                                            | MIT                    | Active                                                        |
| `radix-ui` 1.x (or per-primitive `@radix-ui/*` as GlassyUI requests) | runtime | Accessible primitives under shadcn/GlassyUI   | MIT                    | Active (Oct 2026)                                             |
| `class-variance-authority` 0.7, `clsx` 2.x, `tailwind-merge` 3.x     | runtime | shadcn variant/class helpers                  | Apache-2.0 / MIT / MIT | Stable; cva has no release since 2024 but is feature-complete |
| `lucide-react` 1.x                                                   | runtime | Icons                                         | ISC                    | Active                                                        |
| `tw-animate-css` 1.x                                                 | runtime | shadcn animation utilities                    | MIT                    | Stable                                                        |

Every runtime dependency above is required by the shadcn/GlassyUI generated code. Anything else GlassyUI's CLI tries to add is reviewed before it is accepted.

### Platform behaviour (USB, packaging)

|                | macOS                                                                                       | Windows                                                                                                                                                                                                                                                                | Linux                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebUSB access  | Works without setup. NetMD uses a vendor-specific interface, so no kernel driver claims it. | Chromium WebUSB needs the device bound to the WinUSB driver. MiniDisc devices do not request it, so a driver must be installed (today: Zadig). Expected: without the driver the device is either not listed or `open()` fails, which maps to `access-denied` guidance. | The user needs read/write access to the USB device node. `resources/linux/60-mdconnect.rules` grants it with `TAG+="uaccess"` per vendor/product pair from the device table. A unit test fails if the rules file and the table drift apart. |
| Package        | `.dmg`, unsigned (Gatekeeper requires right-click → Open)                                   | NSIS `.exe`, unsigned (SmartScreen warning)                                                                                                                                                                                                                            | AppImage + `.deb`. The rules file is shipped inside the app's resources but not installed.                                                                                                                                                  |
| Setup guidance | In-app hint only                                                                            | In-app link to minidisc.wiki `#windows`; `docs/platform-setup.md#windows`                                                                                                                                                                                              | In-app link to minidisc.wiki `#linux`; `docs/platform-setup.md#linux` with the bundled rules file                                                                                                                                           |

## Risks / Trade-offs

- [Windows needs a manual driver install, so the desktop app is not plug-and-play there yet] → Document it, show guidance in-app, verify behaviour on real hardware in this change, and plan a follow-up change for installer-driven driver setup (libwdi) or the node `usb` fallback.
- [`electron` postinstall downloads a binary from GitHub, outside the npm age gate] → Electron's download is checksum-verified against the npm package's `checksums.json`. It is the only package opted in to install scripts.
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
