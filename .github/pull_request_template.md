<!--
Title: conventional commit style, in English, e.g. `feat(usb): auto-select a single connected device`.
Branch: feat/…, fix/…, chore/… or docs/…, targeting main.
-->

## Summary

<!-- One or two sentences: what changes and why. -->

**OpenSpec change:** <!-- `openspec/changes/<name>`, or "none" plus the reason (tooling, docs, typo...). -->

### Changes

<!-- Group by area when the PR touches several. Mark breaking changes with **BREAKING**. -->

-

## Test plan

- [ ] `yarn check:affected` passes locally (format, lint, types, tests, OpenSpec validation)
- [ ] New or changed behaviour has tests written first (red → green), named after the spec scenarios they cover
- [ ] Manual verification, when this touches USB, the Electron shell, packaging or UI (delete if not applicable):
  - [ ] macOS: <!-- device model / result -->
  - [ ] Windows: <!-- device model / driver state / result -->
  - [ ] Linux: <!-- distro / udev rule / result -->

<!-- Commands run, scenarios checked and anything not verified. Never mark a check you did not run. -->

### Screenshots

<!-- UI changes only: light and dark theme. Delete otherwise. -->

## Dependencies

- [ ] No new dependencies
- [ ] New dependencies are justified in the change's design.md (purpose, license, maintenance status), pass the 7-day age gate, and do not need install scripts (or are added to the repo-policy allowlist with a reason)

## Code review

- [ ] `/code-review` run on the latest commit: <!-- level and commit sha, e.g. high on abc1234 -->
- [ ] Every finding fixed, or listed below with the reason it was not applied
- [ ] CodeRabbit threads resolved (trigger with `@coderabbitai review` if it did not start)

<!-- Findings and how each was resolved (finding → fix or reason): -->

## Checklist

- [ ] Everything in this PR is in English (code, comments, docs, commits)
- [ ] Docs updated where behaviour or workflow changed (`CLAUDE.md`, `README.md`, `docs/`)
- [ ] OpenSpec tasks ticked only for work verified in this PR
