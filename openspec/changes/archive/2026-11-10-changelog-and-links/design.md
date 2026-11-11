# Design

## Context

- **Version:** `apps/desktop` and `apps/web` are at 0.0.0. The app knows its build commit through `Platform.buildCommit` (a Vite `define` in each shell).
- **Opening links:** the desktop's navigation lock opens `http(s)` links in the system browser (`setWindowOpenHandler` → `shell.openExternal`), and the web app opens them in a new tab. `SourceFooter` already links to the source with `target="_blank"`.
- **Menu:** the More menu (`DiscMenu`) is a Radix dropdown with Export, Import, Wipe, About and Exit.

## Goals / Non-Goals

**Goals:**

- one changelog file, edited in the same PRs that change behaviour;
- the app shows it offline;
- "What's new" appears once per update.

**Non-Goals:** release tooling, and a remote changelog.

## Decisions

### 1. `CHANGELOG.md` at the root, bundled with `?raw`

- **Format:** "Keep a Changelog". Each version is a `## [x.y.z] - YYYY-MM-DD` heading with `### Added` / `### Changed` / `### Fixed` subsections of bullets.
- **Bundling:** `packages/app` imports it with Vite's `?raw` suffix, so it is a string in the bundle. A small parser (`changelog.ts`) reads only that subset: version headings, section headings and `- ` bullets, with inline code and links kept as text.
- **Tests:** they cover the parser and check that the real file parses with at least one version.

Alternative: a TypeScript array, as webminidisc's `changelog.ts`. Rejected: a Markdown file is readable on GitHub and edited like any other doc.

### 2. One version for both apps, passed through `Platform`

- `Platform.version` comes from each shell's `package.json`, through the same `define` mechanism as the commit.
- A repo-policy test keeps the two apps' versions equal, and equal to the newest `CHANGELOG.md` version. A version bump without a changelog entry then fails CI.

### 3. "What's new" from a stored last-seen version

- `mdconnect.lastSeenVersion` in `localStorage` holds the last version shown.
- **On start:**
  - **missing:** store the current version and show nothing (a first install);
  - **lower than the current version:** open the dialog with the versions newer than the stored one, then store the current version;
  - **equal:** show nothing.
- Versions are compared numerically by part. When storage is blocked, nothing opens, the same fallback as Appearance.

### 4. Links are plain anchors in menu items

- Each link item renders an `<a href target="_blank" rel="noreferrer">` through Radix's `asChild`. Keyboard selection activates the anchor.
- **Desktop:** the existing window-open handler sends it to the system browser.
- **Web:** a new tab, so the device session in the app's tab is kept.

## Risks / Trade-offs

- **The changelog gets forgotten in PRs** → the repo-policy version check catches a bump without an entry. The PR template's checklist gains "CHANGELOG.md updated for user-visible changes".
- **A Markdown subset parser** → limited to what the file uses, and tested against the real file.
