# Tasks

## 1. Version and changelog file

- [x] 1.1 Set both apps to 0.1.0, and add `CHANGELOG.md` with a 0.1.0 entry summarising what mdconnect does today (read, edit, play, CSV, wipe, upload). Add a repo-policy test that both versions are equal and match the newest changelog version. Verify that the test passes, and fails when a version is changed alone.
- [x] 1.2 Pass the version to the app as `Platform.version` from both shells. Verify with the platform tests and the About view test (app-menu: "About").
- [x] 1.3 Add "CHANGELOG.md updated for user-visible changes" to the PR template's checklist.

## 2. Changelog in the app

- [x] 2.1 Add `changelog.ts`, which parses the Markdown subset into versions, sections and items, and `versionsSince(changelog, lastSeen)`. Verify with tests on samples and on the real `CHANGELOG.md` (changelog: "Offline").
- [x] 2.2 Add the last-seen store and `whatsNew(stored, current)`. Verify with tests (changelog: "After an update", "First install", "Storage blocked").
- [x] 2.3 Add `ChangelogDialog`, the Changelog menu item and the automatic "What's new" on start. Check in the browser with `?demo` by setting an older last-seen version (changelog: "Open from the menu").

## 3. Menu links

- [ ] 3.1 Add Support and FAQ, Source code on GitHub and Donate to the More menu as links. Verify with a menu test of the hrefs. In the desktop app, check that each opens in the default browser and that the window keeps the app (app-menu: "Open a link").
