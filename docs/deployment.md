# Deploying the web app (Vercel)

The web app (`apps/web`) is a static Vite build served by Vercel. Vercel's GitHub integration deploys `main` to production and creates a preview deployment, with its URL commented, for every pull request that affects the web app. Nothing is deployed from GitHub Actions.

## What lives in the repository

`apps/web/vercel.json` pins everything that can be versioned:

| Setting          | Value                       | Why                                                                                               |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| Install command  | `yarn install --immutable`  | The lockfile must match; the 7-day `npmMinimalAgeGate` in `.yarnrc.yml` also applies on Vercel    |
| Build command    | `yarn turbo run build`      | Yarn resolves the root-hoisted `turbo` binary; turbo infers the `@mdconnect/web` filter           |
| Output directory | `dist`                      | Vite's output                                                                                     |
| Headers          | CSP, COOP, COEP, and others | The CSP is the same string the desktop app sends; `src/vercel-config.test.ts` fails if they drift |
| Rewrites         | `/(.*)` → `/index.html`     | Reloads and shared links on any path load the app                                                 |

## One-time project setup (maintainer)

Create the project in the Vercel dashboard from the GitHub repository `ernest0vm/mdconnect`, then set:

| Dashboard setting                                                                                                                           | Value                  | Why                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| Settings → Build and Deployment → **Root Directory**                                                                                        | `apps/web`             | Vercel infers the turbo filter from it and reads `apps/web/vercel.json`    |
| Settings → Build and Deployment → **Framework Preset**                                                                                      | Vite                   | Matches the `dist` output                                                  |
| Settings → Build and Deployment → **Node.js Version**                                                                                       | 22.x                   | Matches `.nvmrc` and `engines`                                             |
| Settings → Build and Deployment → Root Directory → **Skip deployments when there are no changes to the root directory or its dependencies** | On                     | Pull requests that only touch `apps/desktop` do not build the web app      |
| Settings → Environment Variables → `ENABLE_EXPERIMENTAL_COREPACK`                                                                           | `1` (all environments) | Vercel uses the `packageManager` field (Yarn 4) only with Corepack enabled |
| Settings → General → **Vercel Toolbar**                                                                                                     | Off for previews       | Its injected script is blocked by the app's CSP and COEP                   |

The preview check Vercel adds to pull requests is informative only; it is not a required check on `main`, so a Vercel outage cannot block merges.

## If Corepack on Vercel stops working

Vercel labels Corepack support experimental. If installs fail because Yarn 4 is not picked up, commit the Yarn release into the repository so Vercel runs it without Corepack:

```bash
yarn set version 4.14.1 --yarn-path
```

That writes `.yarn/releases/yarn-4.14.1.cjs` and a `yarnPath` entry in `.yarnrc.yml`. Remove the `ENABLE_EXPERIMENTAL_COREPACK` variable afterwards.

## After the first production deploy

```bash
curl -sI https://<production-domain>/ | grep -iE 'content-security-policy|cross-origin-(opener|embedder)-policy'
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<production-domain>/device
```

The first command must show the three headers; the second must print `200` (the SPA fallback), not `404`. Record the production URL in the README.
