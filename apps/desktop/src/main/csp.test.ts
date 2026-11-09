import { contentSecurityPolicy } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

import { developmentCsp } from './csp';

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe('developmentCsp', () => {
  it('allows the inline React Refresh preamble on top of the production script policy', () => {
    expect(directive(developmentCsp(), 'script-src')).toBe(
      "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
    );
  });

  it("allows Vite's HMR websocket", () => {
    expect(directive(developmentCsp(), 'connect-src')).toContain('ws://localhost:*');
  });

  it('keeps every other production directive unchanged', () => {
    for (const name of ['default-src', 'object-src', 'base-uri', 'frame-ancestors']) {
      expect(directive(developmentCsp(), name)).toBe(directive(contentSecurityPolicy, name));
    }
  });
});
