# mdconnect

Desktop (Electron) port of [webminidisc](https://github.com/asivery/webminidisc) for Sony NetMD / Hi-MD MiniDisc devices. GPL-2.0-only.

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
- Pre-commit: lint-staged on staged files, then `turbo run root:typecheck typecheck test --affected`.
- CI: `.github/workflows/code-quality.yml` runs `check:affected` on pull requests and `check` on `main`.

## Rules

- Package manager is **Yarn 4** (never npm/pnpm). `npmMinimalAgeGate: 7d` rejects versions younger than 7 days; do not bypass it. When `latest` is still quarantined, pin the newest eligible major. Dependency install scripts are disabled; opt a package in with `dependenciesMeta.<pkg>.built: true` only when required and add it to the allowlist in `packages/repo-policy/src/policy.test.ts`.
- TypeScript is pinned to `~6.0` because typescript-eslint does not support TS 7 yet.
- Test-first: use the `tdd` skill for any behaviour change.
- UI: shadcn/ui + Tailwind + GlassyUI. No Material UI, Emotion, styled-components, tss-react or react95 (enforced by repo-policy tests).
- Work goes through OpenSpec: `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Project constraints live in `openspec/config.yaml`.
