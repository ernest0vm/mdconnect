---
name: tdd
description: Test-driven development for mdconnect with Vitest. Use when implementing or changing behaviour in any workspace, when applying an OpenSpec change (/opsx:apply), when fixing a bug, or when the user says TDD, red-green-refactor or "write the test first".
---

# TDD in mdconnect

Every behaviour change starts with a failing test. Work in small red → green → refactor cycles and run the real commands at each step. Do not reason about whether a test "would" pass; run it.

## Where tests live

- Colocated with the code: `src/foo.ts` → `src/foo.test.ts`. Vitest picks up `*.test.ts(x)`.
- Every workspace with a `tsconfig.json` has a `test` script (`vitest run`). `@mdconnect/repo-policy` enforces this.
- Import test APIs explicitly: `import { describe, expect, it } from 'vitest'` (no globals).
- Tests are type-checked and linted like production code. No `any`, no unhandled promises.

## The cycle

1. **Pick one behaviour.** In an OpenSpec change, take the next unchecked task in `tasks.md` and the spec scenario it serves (`#### Scenario:` in `openspec/changes/<change>/specs/**/spec.md`). One scenario becomes one or more `it(...)` cases. Name the test after the scenario so the trace is obvious.
2. **Red.** Write the test before the implementation. Run only that file:
   ```bash
   yarn workspace <pkg> vitest run src/foo.test.ts
   ```
   Confirm it fails **for the expected reason** (an assertion or a missing export, not a typo, a bad import path or a config error). If it fails for another reason, fix the test first. If it passes, the test is not testing new behaviour: tighten it or pick another behaviour.
3. **Green.** Write the minimum code that makes it pass. Rerun the same command. Do not touch the test to make it pass. If the test was wrong, say so explicitly, fix it, and go back to red.
4. **Refactor.** Clean up names, duplication and types with the test still green. Then run the affected checks:
   ```bash
   yarn check:affected
   ```
5. **Mark progress.** Tick the task in `tasks.md` only after its stated verification passes.

## What to test, and what not to fake

- Push logic into **pure functions** (`src/shared/**`, helpers next to features) and test those directly: device tables, selection rules, error classification, path guards, parsers.
- For code that talks to Electron, WebUSB or the filesystem, keep a thin adapter and inject its dependencies (pass the `session`, `navigator.usb` or `fs` functions in). Test the logic with small hand-written fakes. Do not mock modules you own just to reach a line.
- Assert on observable results (return values, emitted events, calls on an injected fake), not on internal state.
- Real hardware and OS behaviour (USB permissions, drivers, installers) cannot be unit-tested. Keep those as manual verification tasks with the exact steps and the observed result written down. Never claim one passed without running it.

## Bugs

Reproduce the bug as a failing test first, then fix it. The test stays as a regression guard.

## Done means

- The new tests failed before the change and pass after it.
- `yarn check:affected` passes (format, lint, types, tests, OpenSpec validation for what changed).
- No skipped (`it.skip`), focused (`it.only`) or commented-out tests are left behind.
