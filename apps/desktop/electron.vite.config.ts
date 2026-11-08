import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

/** Workspace packages are TypeScript source, so main and preload must bundle them, not require them. */
const BUNDLED_WORKSPACES = ['@mdconnect/core'];

export default defineConfig({
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
  },
});
