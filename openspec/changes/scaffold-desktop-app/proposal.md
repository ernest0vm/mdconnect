# Proposal

## Why

The repository has tooling (Yarn workspaces, Turborepo, strict TypeScript, ESLint, Prettier, OpenSpec) but no application. Before any webminidisc feature is ported, we need a runnable, secure Electron app on macOS, Windows and Linux that can reach a MiniDisc device over WebUSB. That proves the hardest platform assumption (WebUSB inside Electron, per OS) early and gives every later change a place to land.

## What Changes

- Add `apps/desktop`: an Electron app with a main process, a preload script and a React renderer, wired into the existing `yarn check` / Turborepo pipeline (`dev`, `build`, `typecheck`, `test`).
- Apply a security baseline to the window: isolated, sandboxed renderer with no Node.js access, a strict Content Security Policy, and blocked navigation and pop-ups.
- Serve the production renderer from a dedicated secure app origin instead of `file://`, so USB permissions can be scoped to that origin.
- Enable WebUSB in the renderer for known NetMD and Hi-MD devices only: the app picks the device when exactly one is connected and asks the user when several are, and connected known devices can be listed without a prompt so the app can reconnect on launch.
- Add the UI foundation: Tailwind CSS 4, shadcn/ui and GlassyUI components, with light and dark themes that follow the OS setting.
- Add a minimal "Connect device" screen: request a device, then show its name and USB IDs or a clear error. This is the walking skeleton, not the final UI.
- Produce unsigned installable builds for the current OS so the app can be tried on real hardware on each platform.
- Record per-OS USB setup findings (Windows driver, Linux udev permissions) from manual hardware testing.

### Out of scope

- Any NetMD / Hi-MD protocol work (reading the disc, track lists, upload, download). `netmd-js` and `himd-js` are not added as dependencies in this change.
- Porting webminidisc screens, state management or audio encoders.
- Unblocking the USB mass-storage class needed by some Hi-MD modes.
- Installing a Windows USB driver or Linux udev rules from the installer.
- Code signing, notarization, auto-update, release CI and store distribution.

## Capabilities

### New Capabilities

- `desktop-shell`: The Electron application window, its security boundaries, how the renderer is loaded, and how the app is built and packaged for each OS.
- `usb-device-access`: Which USB devices the renderer may request, how a device is chosen, how grants persist, and what the user sees when access fails.
- `ui-theme`: The visual foundation every screen uses: component library, glass styling and light/dark appearance.

### Modified Capabilities

None. There are no existing specs.

## Impact

- New workspace `apps/desktop` (`@mdconnect/desktop`).
- New runtime dependencies: `react`, `react-dom`, the shadcn/GlassyUI dependency set (Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`). New dev dependencies: `electron`, `electron-vite`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `electron-builder`, `vitest`, `@types/react`, `@types/react-dom`, `@types/w3c-web-usb`, `eslint-plugin-react-hooks`. Details and justification are in design.md.
- `electron` needs its install script to download the binary, so it is opted in via `dependenciesMeta`. This is the first exception to the "no install scripts" default.
- The root ESLint config gains React rules for `.tsx` files and browser globals for renderer code.
- The root README gains platform setup notes (Linux udev, Windows driver).
