# mdconnect

Port of [webminidisc](https://github.com/asivery/webminidisc) for Sony NetMD / Hi-MD MiniDisc devices, shipped as a desktop app (Electron) and a web app (Vercel) from one codebase. GPL-2.0-only.

## Layout

- `apps/desktop`, `apps/web`: thin shells. Each implements the `Platform` interface from `@mdconnect/app` and nothing else of substance.
- `packages/core`: platform-agnostic TypeScript (device table, USB filters, error classification, later the NetMD/Hi-MD integration). No React, DOM or Node imports.
- `packages/ui`: shadcn/ui + GlassyUI components and theme tokens.
- `packages/app`: React screens and feature logic, written against `Platform`.
- `packages/tsconfig`, `packages/repo-policy`: shared TS config and executable repo rules.

## Commands

- `yarn check:affected`: format, lint, types, tests and OpenSpec validation for what changed relative to `main` (committed and uncommitted). Run this before calling a task done.
- `yarn check`: the same checks for the whole repo (CI runs this on `main`).
- `yarn lint` / `yarn format:check` / `yarn typecheck` / `yarn test`: one check across the repo through turbo.
- `yarn lint:fix` / `yarn format`: autofix.
- `yarn workspace <pkg> vitest run <file>`: run one test file.

## How checks are wired

- Each workspace with a `tsconfig.json` defines `lint`, `format:check`, `typecheck` and `test`, and depends on `@mdconnect/tsconfig` (`workspace:^`). `@mdconnect/repo-policy` tests fail otherwise.
- Root-level files are checked by `root:*` scripts (registered as `//#root:*` turbo tasks). Root ESLint/Prettier ignore `apps/**` and `packages/**`, which the workspaces check themselves.
- Files in `turbo.json` `globalDependencies` (root `package.json`, `.yarnrc.yml`, ESLint/Prettier configs, `.husky/**`) mark every workspace as affected. Task `inputs` do **not** influence `--affected`.
- Pre-commit: `lint-staged --concurrent false --hide-all` fixes staged files, then runs `turbo run root:typecheck typecheck test --affected` on the staged snapshot only (unstaged edits and untracked files are hidden).
- CI: `.github/workflows/code-quality.yml` runs `check:affected` on pull requests (base `origin/<base_ref>` via `TURBO_SCM_BASE`) and `check` on `main`.

## Rules

- **English only.** Code, comments, docs, OpenSpec artifacts, commit messages, branch names, PR titles and descriptions, and review comments are written in English. (Conversation with the maintainer can be in any language.)
- **Every change goes through a PR to `main`** (`main` is protected by two rulesets):
  - **Protect main** (no bypass): PR required, the Code quality check must pass with the branch up to date, no force pushes or deletion.
  - **Require review on main** (repo admins may bypass, only when merging a PR): 1 approval and resolved review threads. The approval comes from CodeRabbit (`.coderabbit.yaml`, `auto_approvals`) once its blocking threads are resolved and the latest commit is reviewed. Pushes dismiss stale approvals; with fewer than 10 repo stars, trigger a review with `@coderabbitai review`.
  - If CodeRabbit is unavailable, the maintainer can merge with `gh pr merge <n> --admin`. That skips only the review ruleset; CI is still required. Only the maintainer decides to use it. Work on a feature branch (`feat/…`, `fix/…`, `chore/…`, `docs/…`).
- **Code review on every PR.** Before opening a PR, and again after any push that changes its code, run `/code-review` on the branch. Fix each finding or state why it was not applied, and fill the "Code review" section of the PR template.
- Package manager is **Yarn 4** (never npm/pnpm). `npmMinimalAgeGate: 7d` rejects versions younger than 7 days; do not bypass it. When `latest` is still quarantined, pin the newest eligible major. Dependency install scripts are disabled; opt a package in with `dependenciesMeta.<pkg>.built: true` in the **root** `package.json` (Yarn ignores it in workspaces) only when required and add it to the allowlist in `packages/repo-policy/src/policy.test.ts`.
- TypeScript is pinned to `~6.0` because typescript-eslint does not support TS 7 yet.
- Test-first: use the `tdd` skill for any behaviour change.
- Clean code: follow the `typescript-clean-code` skill (vendored, see its `SOURCE.md`) when writing, reviewing or refactoring TypeScript. Where it conflicts with this file, this file wins: use the Yarn commands above instead of its `npm` examples (E1/E2), and its "< 100ms per test" rule (T9) applies to unit tests, not to manual hardware verification.
- UI: shadcn/ui + Tailwind + GlassyUI. No Material UI, Emotion, styled-components, tss-react or react95 (enforced by repo-policy tests).
- Work goes through OpenSpec: `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Project constraints live in `openspec/config.yaml`.
