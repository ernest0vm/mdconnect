## Why

The rest of webminidisc's main menu is a Changelog plus links to support, the source code and donations. mdconnect has no version number and no changelog yet, so users cannot see what changed between builds.

## What Changes

- **Versioning:**
  - mdconnect starts at version **0.1.0**, shared by the desktop and web apps.
  - A `CHANGELOG.md` at the repository root lists each version's changes ("Keep a Changelog" style). It is bundled into the app, so it works offline.
- **Changelog:**
  - a **Changelog** item in the More menu opens a dialog listing every version, newest first;
  - after an update, the dialog opens once by itself as "What's new", showing the versions added since the last one seen;
  - a first install does not show it.
- **About** shows the version next to the build commit.
- **More menu links**, opening in the default browser:
  - **Support and FAQ** (https://www.minidisc.wiki/guides/start);
  - **Source code on GitHub** (https://github.com/ernest0vm/mdconnect);
  - **Donate** (https://paypal.me/ernest0vm).

### Out of scope

- Release automation (tags, builds, publishing), and fetching the changelog from the network.
- Self Test and Retro mode from webminidisc's menu.

## Capabilities

### New Capabilities

- `changelog`: the bundled changelog, the Changelog dialog and the "What's new" display after an update.

### Modified Capabilities

- `app-menu`:
  - the Menu requirement adds Changelog and the three links;
  - About shows the version.

## Impact

- **Repository root:** `CHANGELOG.md`.
- **`apps/desktop` and `apps/web`:** each gets version 0.1.0 and passes it to the app through `Platform.version`.
- **`packages/app`:**
  - a new `features/changelog` (Markdown parsing, dialog, "seen" store);
  - `DiscMenu` gains the new items;
  - `AboutDialog` shows the version.
- **No new dependencies:** the changelog's small Markdown subset (headings and bullets) is parsed in the app.
