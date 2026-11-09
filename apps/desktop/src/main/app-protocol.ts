import { readFile } from 'node:fs/promises';

import { contentSecurityPolicy } from '@mdconnect/core';
import { protocol } from 'electron';

import { resolveAppPath } from './app-path';
import { mimeTypeFor } from './mime';

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
    },
  ]);
}

/** Serves the bundled renderer at `app://mdconnect/` with the production CSP. */
export function serveAppProtocol(rendererRoot: string): void {
  protocol.handle('app', async (request) => {
    const file = resolveAppPath(rendererRoot, request.url);
    if (file === null) return new Response('Not found', { status: 404 });
    return new Response(await readFile(file), {
      headers: {
        'Content-Type': mimeTypeFor(file),
        'Content-Security-Policy': contentSecurityPolicy,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
