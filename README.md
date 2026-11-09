# mdconnect

Keep Sony NetMD and Hi-MD MiniDisc devices usable. mdconnect is a port of [Web MiniDisc Pro](https://github.com/asivery/webminidisc) that ships as a **desktop app** (Electron, macOS / Windows / Linux) and, soon, a **web app** for Chromium-based browsers, from one TypeScript codebase.

Current status: the walking skeleton. The app connects to a supported MiniDisc device over WebUSB and shows its name and USB IDs. Disc management is being ported next.

## Credits and license

mdconnect is derived from Web MiniDisc Pro by asivery and builds on [netmd-js](https://github.com/cybercase/netmd-js) and [himd-js](https://github.com/asivery/himd-js). Like them, it is licensed under the **GNU General Public License v2.0** ([LICENSE](LICENSE)). The UI uses [GlassyUI](https://glassyui.com/) components (MIT).

## Getting started

Requirements: Node.js 22.22.1+ on the 22 line, 24.x, or 26+ (the intersection of what lint-staged, ESLint, Vitest and Vite support; Node 23 and 25 are not supported), and Yarn 4 through Corepack. `.nvmrc` selects the latest Node 22.

Use a Node version manager such as nvm or fnm (the repo includes `.nvmrc`); it also keeps global npm installs in a user-writable directory. Node 22 and 24 ship Corepack. Node 26 no longer does, so install it first there. With a system-wide Node install this can fail with `EACCES`; see npm's [guide to fixing permissions](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally/).

```bash
npm install -g corepack
```

Then enable it and install:

```bash
corepack enable
```

```bash
yarn install
```

```bash
yarn dev
```

`yarn dev` starts the desktop app with hot reload. Before connecting a device on Windows or Linux, follow [docs/platform-setup.md](docs/platform-setup.md).

## Commands

| Command               | What it does                                                                |
| --------------------- | --------------------------------------------------------------------------- |
| `yarn dev`            | Run the desktop app in development                                          |
| `yarn check`          | Format, lint, type-check, test and validate OpenSpec for the whole repo     |
| `yarn check:affected` | The same, only for what changed relative to `main`                          |
| `yarn package`        | Build an unsigned installer for the current OS into `apps/desktop/release/` |

## Repository layout

```
apps/desktop      Electron shell (main process, preload, renderer entry)
packages/core     Platform-agnostic logic: device table, USB filters, error kinds
packages/ui       Design system: GlassyUI components, theme
packages/app      React screens written against a Platform interface
packages/tsconfig Shared TypeScript configs
packages/repo-policy  Executable repository rules
openspec/         Specs and change proposals
```

Contributor rules (TDD, English only, PRs with code review, the 7-day dependency age gate) are in [CLAUDE.md](CLAUDE.md).
