# Design

## Context

See proposal.md for motivation. This change assumes `scaffold-desktop-app` is applied:

- `@mdconnect/core` exports the device table, `usbFilters()`, `classifyUsbError()` and `contentSecurityPolicy`.
- `@mdconnect/ui` exports the components, `globals.css`, `resolveAppearance()` and `applyAppearance()`.
- `@mdconnect/app` exports `<App platform={…} />` and the `Platform` interface (`kind`, `os`, `usb`, optional `deviceChooser`, `appearance`).
- Shared packages are consumed as TypeScript source by each app's bundler.

In a browser, WebUSB differs from Electron in two ways that matter here. `navigator.usb.requestDevice()` opens Chrome's own chooser, filtered by the `filters` argument. Grants persist per origin: `navigator.usb.getDevices()` returns only devices the user picked before. WebUSB requires a secure context and exists only in Chromium-based browsers.

## Goals / Non-Goals

**Goals:**

- A web shell that is as thin as the desktop renderer entry: build a `Platform`, render `<App>`.
- The same security posture as the packaged desktop app (identical CSP), plus cross-origin isolation from day one.
- Zero-touch deploys: production on merge, previews on pull requests, no build when the web app is unaffected.

**Non-Goals:**

- Service worker, offline cache or PWA install.
- Supporting browsers without WebUSB beyond explaining the situation.
- Running the deploy from GitHub Actions. Vercel's GitHub integration does it.

## Decisions

### 1. `apps/web` is a plain Vite SPA

```
apps/web/
  index.html
  vite.config.ts        React + Tailwind plugins; dev server sends COOP/COEP
  vercel.json           headers, rewrites, install/build/output settings
  src/main.tsx          webPlatform() + <App/> or <UnsupportedBrowser/>
  src/platform.ts       detectOs(), isWebUsbSupported(), webPlatform()
  src/styles.css        @import "@mdconnect/ui/globals.css" + @source for packages/ui and packages/app
  test/vercel-config.test.ts
```

`tsconfig.json` extends `@mdconnect/tsconfig/react.json` with `types: ["w3c-web-usb", "vite/client"]`. Scripts: `dev`, `build` (`vite build` → `dist`), `preview`, and the four check scripts. Root gains `dev:web` (`turbo run dev --filter=@mdconnect/web`).

- Alternative: **Next.js**. Rejected: there is no server rendering to do. Everything runs against the user's USB device in the browser, and a static SPA keeps the web and desktop renderers identical.

### 2. Web `Platform`

- `kind: 'web'`.
- `os`: `detectOs()` reads `navigator.userAgentData.platform` when available, falling back to `navigator.userAgent`. It maps to `macos` / `windows` / `linux` / `chromeos` / `other`. It is pure and unit-tested with recorded user-agent samples.
- `usb`: `navigator.usb`.
- Device filters: `Platform` gains `deviceKinds: readonly DeviceKind[]`. The desktop entry sets every kind, the web entry sets `['netmd']`, and the Connect screen in `@mdconnect/app` requests with `usbFilters({ kinds: platform.deviceKinds })`, so the shared screen needs no platform checks. Hi-MD-mode IDs present only the USB mass-storage class, which Chromium protects from web pages and hides from the WebUSB chooser, so filtering on them would only promise devices the browser cannot expose. The desktop app keeps every ID: Electron can unblock protected classes with `setUSBProtectedClassesHandler`, which the Hi-MD integration change will decide. The web `no-device` guidance says mdconnect does not support Hi-MD mode yet and suggests NetMD mode. It does not claim browsers cannot do it: upstream Web MiniDisc Pro reaches Hi-MD mode in the browser through `himd-js`'s File System Access backend (`fsa-filesystem`) on the mounted volume, which is a candidate for the Hi-MD integration change. It does not point to the desktop app, which also lacks Hi-MD-mode access until the Hi-MD integration change; that change updates this message when it lands.
- `deviceChooser`: omitted. The browser's chooser handles selection, so `@mdconnect/app` never shows its own dialog on the web. Chrome rejects `requestDevice` with the same `NotFoundError` whether the user cancelled or the list was empty, and `classifyUsbError` has no chooser result to tell them apart, so on the web both map to `no-device`. `guidanceFor('no-device', os)` adds the "pick the device in the browser's list" hint when `platform.kind === 'web'`.
- `appearance`: no platform signal (`{}`), so reduced transparency comes only from the `prefers-reduced-transparency` media query that `resolveAppearance()` already reads. `onChange` returns a no-op unsubscribe.

`isWebUsbSupported({ secureContext, hasUsb })` decides between `<App>` and `<UnsupportedBrowser>` before any USB call. Both screens live in `@mdconnect/app`, so they share the design system and the source footer.

### 3. Source link and unsupported-browser screen in `@mdconnect/app`

`@mdconnect/core` exports `sourceRepositoryUrl` (`https://github.com/ernest0vm/mdconnect`) and `licenseName` (`GPL-2.0`). Each shell injects the commit it was built from as `__MDCONNECT_COMMIT__` (Vite `define`: `VERCEL_GIT_COMMIT_SHA` on Vercel, `git rev-parse HEAD` otherwise, empty in dev). `sourceLink(commit)` in `core` returns `<repo>/tree/<sha>`, or the repository root when no commit is known. `@mdconnect/app` renders a small footer with that link and the license on every screen, so users reach the source of the exact version they run. That satisfies the GPL obligation for distributed JavaScript on the web, and it is harmless on desktop. `<UnsupportedBrowser>` names Chrome, Edge, Opera and other Chromium-based browsers, and links to the repository README's download section. A releases page replaces that link once a release workflow exists.

### 4. Headers and routing in `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "<contentSecurityPolicy from @mdconnect/core>"
        },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ],
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`vercel.json` is static JSON and cannot import TypeScript, so `test/vercel-config.test.ts` parses it and asserts that:

- the CSP equals `contentSecurityPolicy` from `@mdconnect/core`;
- COOP/COEP have the values above;
- the SPA rewrite exists.

The desktop and web policies cannot drift without a failing test. Vercel serves existing static files before applying rewrites, so assets are unaffected. The Vite dev server sends COOP/COEP too, so `crossOriginIsolated` behaves the same in development.

### 5. Vercel project configuration

Done once by the maintainer in the Vercel dashboard. The values are documented in `docs/deployment.md`:

| Setting                            | Value                                     | Why                                                                                                                 |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Root Directory                     | `apps/web`                                | Vercel infers the turbo filter from it                                                                              |
| Framework preset                   | Vite                                      | Output directory `dist`                                                                                             |
| Build command                      | `yarn turbo run build` (in `vercel.json`) | Yarn resolves the root-hoisted `turbo` binary from `apps/web`; filter inferred from the Root Directory              |
| Install command                    | `yarn install --immutable`                | Lockfile must match. The 7-day `npmMinimalAgeGate` from `.yarnrc.yml` applies in the build too                      |
| Env `ENABLE_EXPERIMENTAL_COREPACK` | `1`                                       | Vercel uses the `packageManager` Yarn 4 only with Corepack enabled                                                  |
| Node.js version                    | 22.x                                      | Matches `.nvmrc` / `engines`                                                                                        |
| Skip unaffected deployments        | On                                        | Vercel's built-in monorepo skipping. Fallback: Ignored Build Step `yarn dlx turbo-ignore@2.11.10 --fallback=HEAD^1` |
| Vercel Toolbar on previews         | Off                                       | Its injected script is blocked by our CSP and COEP                                                                  |

Previews are created for every pull request by Vercel's GitHub integration, which comments the URL on the PR. The preview check is informative and is not added to the `main` rulesets: the Code quality check already gates merges, and an outage at Vercel should not block them.

- Alternative: **deploy from GitHub Actions with the Vercel CLI**. Rejected: it needs a Vercel token as a repository secret and re-implements what the integration does.

### Desktop vs web

|                      | Desktop                                | Web                                            |
| -------------------- | -------------------------------------- | ---------------------------------------------- |
| Device chooser       | In-app dialog fed by the main process  | Browser chooser                                |
| Grants               | Main process auto-grants known devices | Browser remembers devices the user picked      |
| CSP / COOP / COEP    | `app://` protocol handler              | `vercel.json` (same CSP string, test-enforced) |
| Reduced transparency | `nativeTheme` + media query            | Media query only                               |
| OS detection         | `process.platform` via preload         | `detectOs()` from user-agent data              |
| Updates              | Installer (later: auto-update)         | Every deploy                                   |

### OS behaviour

USB requirements are the same as for the desktop app in Chromium: macOS works without setup, Windows needs the WinUSB driver, and Linux needs the udev rule. The guidance from `guidanceFor(kind, os)` is identical. Chrome on Linux distributed as a Snap or Flatpak may also lack USB access to the device. The Linux guidance links to the community guide's section on sandboxed browsers.

### Dependencies

No new packages. `apps/web` uses `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `react`, `react-dom` and `vitest` at the versions `scaffold-desktop-app` adds. `turbo-ignore` is only a pinned `yarn dlx` fallback and is not installed.

## Risks / Trade-offs

- [Vercel's Corepack support is labelled experimental] → If it breaks, commit the Yarn release (`yarn set version 4.14.1 --yarn-path`) so Vercel runs `.yarn/releases/yarn-4.14.1.cjs` without Corepack.
- [COEP `require-corp` blocks any cross-origin resource without CORP/CORS headers] → The app loads nothing cross-origin today. Future integrations (for example song recognition) must use CORS-enabled endpoints, and the CSP `connect-src` must be widened in `@mdconnect/core` for both apps at once.
- [Vercel Hobby plan terms are for non-commercial use] → mdconnect is a non-commercial open-source project. Revisit if that changes.
- [Users may not know how to revoke a device grant] → Out of scope for this change. A later settings screen can link to `chrome://settings/content/usbDevices`.
- [The deployed site is public as soon as `main` deploys] → The repository is already public under GPL-2.0, and the site only talks to the user's local USB device.

## Migration Plan

Apply after `scaffold-desktop-app` is archived. Rollback: remove the Vercel project or redeploy a previous deployment from the Vercel dashboard. The repository change can be reverted independently.

## Open Questions

- Production domain: the default `*.vercel.app` URL is used until the maintainer picks a custom domain. That only changes links in the README and the desktop app's "use the web version" text.
