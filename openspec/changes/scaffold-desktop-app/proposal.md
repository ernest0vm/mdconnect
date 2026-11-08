# Proposal

## Why

The repository has tooling (Yarn workspaces, Turborepo, strict TypeScript, ESLint, Prettier, OpenSpec) but no application. mdconnect ships as two apps from one codebase: a desktop app (Electron) and a web app (Vercel, see the `add-web-app` change). Before any webminidisc feature is ported, we need the shared foundation both apps build on, and a runnable, secure Electron app on macOS, Windows and Linux that reaches a MiniDisc device over WebUSB. That proves the hardest platform assumption (WebUSB inside Electron, per OS) early, and it fixes where code lives before there is code to move.

## What Changes

- Add three shared workspaces that hold all behaviour:
  - `packages/core` (`@mdconnect/core`): platform-agnostic TypeScript with the supported device table, USB filters, device selection and USB error classification.
  - `packages/ui` (`@mdconnect/ui`): the design system with Tailwind CSS 4, shadcn/ui and GlassyUI components, theme tokens, and light/dark plus reduced-transparency styling.
  - `packages/app` (`@mdconnect/app`): the React app (screens, feature logic) written against a `Platform` interface that each shell implements.
- Add `apps/desktop` as a thin Electron shell: main process, preload bridge and a renderer entry that mounts `@mdconnect/app` with the desktop `Platform`. It is wired into the `yarn check` / Turborepo pipeline (`dev`, `build`, `typecheck`, `test`, `package`).
- Apply a security baseline to the desktop window: isolated, sandboxed renderer with no Node.js access, a strict Content Security Policy, and blocked navigation and pop-ups.
- Serve the packaged desktop renderer from a dedicated secure app origin instead of `file://`, so USB permissions can be scoped to that origin.
- Enable WebUSB in the desktop app for known NetMD and Hi-MD devices only. The app picks the device when exactly one is connected and asks the user when several are. Connected known devices can be listed without a prompt, so the app can reconnect on launch.
- Add a minimal "Connect device" screen in `@mdconnect/app`: request a device, then show its name and USB IDs or a clear, OS-aware error. This is the walking skeleton, not the final UI.
- Produce unsigned installable desktop builds for the current OS so the app can be tried on real hardware on each platform.
- Record per-OS USB setup findings (Windows driver, Linux udev permissions) from manual hardware testing.

### Out of scope

- The web app (`apps/web`, Vercel deployment). It is the `add-web-app` change, which builds on the packages created here.
- Any NetMD / Hi-MD protocol work (reading the disc, track lists, upload, download). `netmd-js` and `himd-js` are not added as dependencies in this change.
- Porting webminidisc screens, state management or audio encoders.
- Unblocking the USB mass-storage class needed by some Hi-MD modes.
- Installing a Windows USB driver or Linux udev rules from the installer.
- Code signing, notarization, auto-update, release CI and store distribution.

## Capabilities

### New Capabilities

- `desktop-shell`: The Electron application window, its security boundaries, how the renderer is loaded, and how the desktop app is built and packaged for each OS.
- `usb-device-access`: Which USB devices the app may request, how a device is chosen, how grants persist, and what the user sees when access fails. This change adds the shared requirements and the desktop-specific ones; `add-web-app` adds the web-specific ones.
- `ui-theme`: The visual foundation every screen uses in both apps: component library, glass styling, light/dark appearance and accessibility preferences.

### Modified Capabilities

None. There are no existing specs.

## Impact

- New workspaces: `packages/core`, `packages/ui`, `packages/app`, `apps/desktop`. Shared packages are consumed as TypeScript source (no build step), and `@mdconnect/repo-policy` applies to all of them.
- New runtime dependencies: `react`, `react-dom`, and the shadcn/GlassyUI dependency set (Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`). New dev dependencies: `electron`, `electron-vite`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `electron-builder`, `@types/react`, `@types/react-dom`, `@types/w3c-web-usb`, `eslint-plugin-react-hooks`. Details and justification are in design.md.
- `electron` needs its install script to download the binary, so it is opted in via root `dependenciesMeta`. This is the first exception to the "no install scripts" default.
- The root ESLint config gains React rules for `.tsx` files and browser globals for UI code.
- The root README gains the workspace layout and platform setup notes (Linux udev, Windows driver).
