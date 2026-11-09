import { buildCsp, CSP_DIRECTIVES } from '@mdconnect/core';

/** Development only: Vite's React Refresh preamble is an inline script and HMR uses a websocket. */
export function developmentCsp(): string {
  return buildCsp({
    ...CSP_DIRECTIVES,
    'script-src': [...(CSP_DIRECTIVES['script-src'] ?? []), "'unsafe-inline'"],
    'connect-src': [
      ...(CSP_DIRECTIVES['connect-src'] ?? []),
      'ws://localhost:*',
      'http://localhost:*',
    ],
  });
}
