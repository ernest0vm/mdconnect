// Electron 44 downloads its binary on first use (checksum-verified) instead of in a postinstall
// script. electron-vite looks for the binary without triggering that download, so on a fresh
// clone `yarn dev` fails with "Electron uninstall" unless we require Electron first.
import { createRequire } from 'node:module';

createRequire(import.meta.url)('electron');
