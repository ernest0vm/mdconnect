# Tasks

## 1. Workspace and dependencies

- [ ] 1.1 Create `apps/desktop/package.json` (`@mdconnect/desktop`, private, `GPL-2.0-only`, `type: module`, `main: out/main/index.js`) with scripts `dev`, `build`, `package` and the check scripts every workspace needs (`lint`, `format:check`, `typecheck`, `test`, same commands as `packages/repo-policy`), `@mdconnect/tsconfig: workspace:^` in devDependencies. In the **root** `package.json`, add `dependenciesMeta.electron.built: true` (Yarn only reads it there) and forwarding scripts `dev` (`turbo run dev --filter=@mdconnect/desktop`) and `package` (`turbo run package --filter=@mdconnect/desktop`), so `yarn dev` works from the repo root. Remove `apps/.gitkeep`. Verify `yarn workspaces list` shows `@mdconnect/desktop` and `yarn workspace @mdconnect/repo-policy test` passes (it enforces the scripts, the tsconfig dependency and the install-script allowlist).
- [ ] 1.2 Add dev dependencies (`electron`, `electron-vite`, `vite`, `@vitejs/plugin-react`, `electron-builder`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `@types/react`, `@types/react-dom`, `@types/w3c-web-usb`, `@types/node`) and runtime `react`, `react-dom`. Where `latest` is still inside the 7-day gate, pin the newest eligible major (`electron@^44`, `vitest@^4`). Verify `yarn install` succeeds with no quarantine errors and `yarn electron --version` prints a 44.x version.

## 2. Build pipeline and lint wiring

- [ ] 2.1 Add `tsconfig.json` (solution), `tsconfig.node.json` (main, preload, shared, `electron.vite.config.ts`; extends `@mdconnect/tsconfig/node.json`) and `tsconfig.web.json` (renderer, shared; extends `react.json`, `types: ["w3c-web-usb"]`, `@/*` path alias). Verify `yarn workspace @mdconnect/desktop typecheck` passes on placeholder entry files.
- [ ] 2.2 Add `electron.vite.config.ts` with main, preload (CJS output for the sandboxed preload) and renderer (React plugin, Tailwind plugin, `@` alias) builds. Verify `yarn workspace @mdconnect/desktop build` writes `out/main`, `out/preload` and `out/renderer`.
- [ ] 2.3 Extend root `eslint.config.mjs`: `eslint-plugin-react-hooks` recommended for `**/*.tsx`, `globals.browser` for `apps/desktop/src/{renderer,preload}/**`. Add `eslint-plugin-react-hooks` to root dev dependencies. Verify `yarn lint` passes and that a deliberately conditional hook call in a scratch `.tsx` file is reported (then remove it).
- [ ] 2.4 Add a `package` task to `turbo.json` (`cache: false`, outputs `release/**`). `release/` is already ignored by `.gitignore`/`.prettierignore`. Verify `yarn check:affected` runs the desktop `lint`, `format:check`, `typecheck` and `test` tasks, and `yarn check` passes.
- [ ] 2.5 Confirm no package other than `electron` needs install scripts. Run `yarn workspace @mdconnect/desktop build` and, if a tool fails because a script did not run, opt in only that package via root `dependenciesMeta` and add it with a reason to `INSTALL_SCRIPT_ALLOWLIST` in `packages/repo-policy/src/policy.test.ts`. Verify the final `dependenciesMeta` lists only justified packages.

## 3. Main process shell and security

- [ ] 3.1 Implement `src/main/index.ts`: single-instance lock (second instance focuses and restores the existing window), main window creation, macOS `activate` re-creating the window, `app.enableSandbox()`. Verify manually: `yarn dev` opens one window, and a second `yarn electron out/main/index.js` launch focuses the first instead of opening another.
- [ ] 3.2 Implement `src/main/security.ts`: hardened `webPreferences`, `will-navigate`/`will-redirect` prevention, `setWindowOpenHandler` (deny; `shell.openExternal` for `http:`/`https:` only), `setPermissionRequestHandler` deny-all, dev-only relaxed CSP via `webRequest.onHeadersReceived`. Unit-test the URL scheme filter (`https:` allowed, `file:`/`javascript:`/custom denied). Verify in the dev window console that `typeof require`, `typeof process` are `"undefined"` and `eval("1")` throws.

## 4. App protocol

- [ ] 4.1 Implement `src/main/app-protocol.ts`: register `app` as privileged (`standard`, `secure`, `supportFetchAPI`, `codeCache`) before ready, then `protocol.handle` serving `out/renderer` with correct MIME types and the production CSP header. Extract the path resolution into a pure `resolveAppPath(root, url)`. Verify with unit tests that `../` traversal, encoded traversal (`%2e%2e%2f`), absolute paths and missing files are rejected, and that `/` maps to `index.html`.
- [ ] 4.2 Load `app://mdconnect/index.html` when packaged (or when `ELECTRON_RENDERER_URL` is unset) and the dev-server URL otherwise. Add `isAppOrigin()` accepting the dev origin only when `!app.isPackaged`, with unit tests for both modes. Verify `yarn workspace @mdconnect/desktop build && yarn electron apps/desktop/out/main/index.js` shows the UI with `location.origin === "app://mdconnect"` and the CSP header present (DevTools → Network).

## 5. Device table and selection logic

- [ ] 5.1 Create `src/shared/devices.ts` with the 47 NetMD entries from `netmd-js` 4.4.1 and 14 Hi-MD entries from `himd-js` 0.2.15 (`vendorId`, `productId`, `name`, `kind`) under a GPL-2.0 attribution header. Add `findDevice(vendorId, productId)`, `isSupportedDevice()` and `usbFilters()`. Unit-test entry counts, the `054c:0286` → "Sony MZ-RH1" and `054c:0287` → Hi-MD "Sony MZ-RH1" lookups, the shared `054c:0187` pair resolving to the NetMD name, and that an unknown pair is unsupported.
- [ ] 5.2 Create `src/shared/device-selection.ts` with a pure `chooseDevice(devices)` returning `none` / `auto(id)` / `ask(list)`. Unit-test zero, one and several devices, and that unsupported devices in the input are ignored.
- [ ] 5.3 Add `resources/linux/60-mdconnect.rules` with one `SUBSYSTEM=="usb", ATTR{idVendor}=="…", ATTR{idProduct}=="…", TAG+="uaccess"` line per table entry. Add a unit test that parses the file and fails if any table entry is missing or any rule is not in the table. Verify the test passes and fails when one line is deleted.

## 6. USB session handlers and preload bridge

- [ ] 6.1 Define IPC channel names and payload types in `src/shared/ipc.ts` (`usb:choose-device`, `usb:device-chosen`, `appearance:changed`). Verify they are imported by both main and preload without type errors (`yarn typecheck`).
- [ ] 6.2 Implement `src/main/usb.ts`: `setPermissionCheckHandler` (USB only for the app origin), `setDevicePermissionHandler` (app origin + supported device), `select-usb-device` using `chooseDevice`, and the chooser bridge with a single pending request that is cancelled on a new request, renderer reload or window close. Validate incoming `requestId`/`deviceId` against the pending request. Unit-test the pending-request state machine (respond, stale `requestId`, unknown `deviceId`, cancel on supersede) with Electron APIs injected as fakes.
- [ ] 6.3 Implement `src/preload/index.ts` exposing exactly `window.mdconnect` (`platform`, `usb.onChooseDevice`, `usb.respondChooseDevice`, `appearance.get`, `appearance.onChange`) via `contextBridge`, plus a `src/renderer/env.d.ts` global type. Verify in the dev console that `Object.keys(window.mdconnect)` is `["platform","usb","appearance"]` and `yarn typecheck` passes.

## 7. UI foundation

- [ ] 7.1 Set up Tailwind 4 (`@import "tailwindcss"` in the renderer stylesheet) and run `yarn dlx shadcn@4.23.0 init` in `apps/desktop` (`components.json`: `tsx`, no RSC, alias `@/`). Review every dependency the CLI adds against design.md and keep only the listed ones. Verify `yarn dev` renders a shadcn `Button` styled by Tailwind.
- [ ] 7.2 Add the GlassyUI components (Surface, Panel, Button, Dialog, Spinner, Alert, Badge) with `yarn dlx shadcn@4.23.0 add @glassyui/<name>`. Fix any lint or strict-TS errors in the generated source rather than disabling rules. Verify `yarn check` passes and the components render in a temporary preview in `App.tsx`.
- [ ] 7.3 Implement `src/renderer/lib/theme.ts`: set `data-lg-theme` and the `dark` class from `prefers-color-scheme` and update them live. Set `data-reduced-transparency` from `window.mdconnect.appearance`, and add CSS overrides that make glass surfaces opaque without `backdrop-filter` when it is set. Main sets `nativeTheme.themeSource = "system"` and forwards `nativeTheme` `updated` events. Combine `nativeTheme.prefersReducedTransparency` with the `prefers-reduced-transparency` media query (either one enables it) in a pure function with unit tests. Verify manually on macOS: toggling System Settings → Appearance switches the app live, and enabling Accessibility → Display → Reduce transparency makes panels opaque. On Linux, record in `docs/platform-setup.md` whether the tested desktop reports the preference.
- [ ] 7.4 Ensure animations are disabled under `prefers-reduced-motion: reduce` and every control has a visible focus ring in both themes. Verify manually with Reduce motion on (dialog opens with no transition) and by tabbing through the UI in light and dark.
- [ ] 7.5 Check text contrast on glass surfaces in both appearances with DevTools' contrast checker over a light and a dark desktop wallpaper. Adjust tokens until body text is at least 4.5:1. Record the measured ratios in the PR description.

## 8. Connect screen

- [ ] 8.1 Implement `classifyUsbError(error, phase)` and `guidanceFor(kind, platform)` in `src/renderer/features/connect/` returning message text and an optional link (minidisc.wiki `#windows` / `#linux`). Unit-test every kind × platform combination required by the usb-device-access spec.
- [ ] 8.2 Build the Connect screen: a "Connect device" button calling `navigator.usb.requestDevice({ filters: usbFilters() })` then `device.open()`. Show the device name and `vvvv:pppp` IDs on success, or the classified message and link on failure. Show a spinner while pending. Verify manually with no device connected that the "no device found" message appears.
- [ ] 8.3 Build the multi-device chooser dialog driven by `window.mdconnect.usb.onChooseDevice`, listing devices by name, USB IDs and serial number (numbered in connection order with an "unplug the other device" hint when serials are missing or equal), with Cancel mapping to `cancelled`. Verify with two devices (or by temporarily faking a second entry in `chooseDevice`'s input in dev) that choosing returns that device and Cancel shows the cancelled state.
- [ ] 8.4 On startup call `navigator.usb.getDevices()` and show an already connected supported device without a prompt. Subscribe to `navigator.usb` `connect`/`disconnect` to update the screen. Verify manually by launching with a device plugged in, then unplugging and replugging it.

## 9. Packaging

- [ ] 9.1 Add `electron-builder.yml`: `appId: org.mdconnect.desktop`, `productName: mdconnect`, `asar: true`, `directories.output: release`, mac `dmg`, win `nsis`, linux `AppImage` + `deb`, `extraResources` for `resources/linux/60-mdconnect.rules`, and `electronFuses` as listed in design.md. Verify `yarn workspace @mdconnect/desktop package` on macOS produces a `.dmg` in `apps/desktop/release/`.
- [ ] 9.2 Verify fuses on the packaged macOS app with `yarn dlx @electron/fuses@2.1.3 read --app <path to .app>` (pinned, older than 7 days) (RunAsNode off, OnlyLoadAppFromAsar on), then install the `.dmg` and confirm the app opens offline with Wi-Fi disabled.

## 10. Documentation

- [ ] 10.1 Write `docs/platform-setup.md` with macOS, Windows (WinUSB driver via Zadig, admin rights, restart the app) and Linux (copy `60-mdconnect.rules` to `/etc/udev/rules.d/`, `udevadm control --reload && udevadm trigger`, replug) sections. Verify the Linux commands by running them on a Linux machine during 11.3.
- [ ] 10.2 Update the root `README.md`: what mdconnect is, credit and license (GPL-2.0, derived from webminidisc), requirements (Node 22, Yarn 4), `yarn dev` / `yarn check` / package commands, and a link to `docs/platform-setup.md`. Verify every command in the README runs as written from a clean clone.

## 11. Hardware verification per OS

- [ ] 11.1 macOS with a real NetMD device: connect, see name and IDs, unplug and replug, relaunch with the device attached. Record the model tested in `docs/platform-setup.md`.
- [ ] 11.2 Windows: build the installer on Windows, install it, try connecting before installing the WinUSB driver and record the exact behaviour (device not listed vs. `open()` error) and the message shown. Install the driver with Zadig and confirm the connect succeeds. Update `docs/platform-setup.md#windows` and resolve the matching open question in design.md.
- [ ] 11.3 Linux: build the AppImage and `.deb`, try connecting without the udev rule (expect the access-denied guidance), install the rule per the docs and confirm the connect succeeds.
- [ ] 11.4 Run `yarn check` from the repo root on a clean clone and confirm it passes, and that the Code quality workflow passes on the pull request.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review and hardware verification.
- Propose the next changes: NetMD protocol integration (`netmd-js`), Windows driver setup in the installer, Hi-MD mass-storage access.
