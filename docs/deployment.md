# Deploying the web app (Vercel)

The web app (`apps/web`) is a static Vite build served by Vercel. Vercel's GitHub integration deploys `main` to production and creates a preview deployment, with its URL commented, for every pull request that affects the web app. Nothing is deployed from GitHub Actions.

## What lives in the repository

`apps/web/vercel.json` pins everything that can be versioned:

| Setting          | Value                         | Why                                                                                                                                                                        |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install command  | `yarn install --immutable`    | The lockfile must match; the 7-day `npmMinimalAgeGate` in `.yarnrc.yml` also applies on Vercel                                                                             |
| Build command    | `yarn run -T turbo run build` | Yarn 4 resolves binaries per workspace, so `-T` (`--top-level`) takes `turbo` from the root workspace; turbo infers the `@mdconnect/web` filter from the working directory |
| Output directory | `dist`                        | Vite's output                                                                                                                                                              |
| Headers          | CSP, COOP, COEP, and others   | The CSP is the same string the desktop app sends; `test/vercel-config.test.ts` fails if they drift                                                                         |
| Rewrites         | `/(.*)` → `/index.html`       | Reloads and shared links on any path load the app                                                                                                                          |

## One-time project setup (maintainer)

Create the project in the Vercel dashboard from the GitHub repository `ernest0vm/mdconnect`, then set:

| Dashboard setting                                                                                                                           | Value            | Why                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| Settings → Build and Deployment → **Root Directory**                                                                                        | `apps/web`       | Vercel infers the turbo filter from it and reads `apps/web/vercel.json` |
| Settings → Build and Deployment → **Framework Preset**                                                                                      | Vite             | Matches the `dist` output                                               |
| Settings → Build and Deployment → **Node.js Version**                                                                                       | 22.x             | Matches `.nvmrc` and `engines`                                          |
| Settings → Build and Deployment → Root Directory → **Skip deployments when there are no changes to the root directory or its dependencies** | On               | Pull requests that only touch `apps/desktop` do not build the web app   |
| Settings → General → **Vercel Toolbar**                                                                                                     | Off for previews | Its injected script is blocked by the app's CSP and COEP                |

The preview check Vercel adds to pull requests is informative only; it is not a required check on `main`, so a Vercel outage cannot block merges.

## Yarn without Corepack

Vercel's Corepack support is experimental, so the project does not use it. The Yarn release is committed at `.yarn/releases/yarn-4.14.1.cjs` and `.yarnrc.yml` points to it with `yarnPath`. Whatever Yarn Vercel starts with hands over to that file, so the build runs the same Yarn 4.14.1 as local machines and CI, with the 7-day age gate. Do not set `ENABLE_EXPERIMENTAL_COREPACK`.

To update Yarn, run the command below, restore the comments it strips from `.yarnrc.yml`, and check that `packageManager` in `package.json` names the same version (a repo-policy test fails otherwise):

```bash
yarn set version <x.y.z> --yarn-path
```

## After the first production deploy

```bash
curl -sI https://mdconnect.vercel.app/ | grep -iE 'content-security-policy|cross-origin-(opener|embedder)-policy'
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://mdconnect.vercel.app/device
```

The first command must show the three headers; the second must print `200` (the SPA fallback), not `404`. Both passed on the first production deploy (merge of PR #4, 2026-11-09).
