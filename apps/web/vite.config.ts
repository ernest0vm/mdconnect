import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Same isolation headers as production (vercel.json), so crossOriginIsolated behaves alike. */
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/** Commit for the GPL source link: Vercel's build SHA, else the local git HEAD, else unknown. */
function buildCommit(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha !== undefined && vercelSha !== '') return vercelSha;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** The app version from this shell's package.json, kept equal to the newest CHANGELOG.md entry. */
function appVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return manifest.version;
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    __MDCONNECT_COMMIT__: JSON.stringify(command === 'build' ? buildCommit() : ''),
    __MDCONNECT_VERSION__: JSON.stringify(appVersion()),
  },
  server: { headers: ISOLATION_HEADERS },
  preview: { headers: ISOLATION_HEADERS },
}));
