import { execSync } from 'node:child_process';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

/** Workspace packages are TypeScript source, so main and preload must bundle them, not require them. */
const BUNDLED_WORKSPACES = ['@mdconnect/core'];

/** Commit for the GPL source link: the local git HEAD, or unknown outside a checkout. */
function buildCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export default defineConfig(({ command }) => ({
  main: {
    build: { externalizeDeps: { exclude: BUNDLED_WORKSPACES } },
  },
  preload: {
    build: {
      externalizeDeps: { exclude: BUNDLED_WORKSPACES },
      // Sandboxed preloads must be CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    define: { __MDCONNECT_COMMIT__: JSON.stringify(command === 'build' ? buildCommit() : '') },
  },
}));
