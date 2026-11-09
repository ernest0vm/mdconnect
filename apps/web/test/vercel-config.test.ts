import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contentSecurityPolicy } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

interface VercelConfig {
  readonly installCommand?: string;
  readonly buildCommand?: string;
  readonly outputDirectory?: string;
  readonly headers?: readonly {
    readonly source: string;
    readonly headers: readonly { readonly key: string; readonly value: string }[];
  }[];
  readonly rewrites?: readonly { readonly source: string; readonly destination: string }[];
}

const config = JSON.parse(
  readFileSync(join(import.meta.dirname, '../vercel.json'), 'utf8'),
) as VercelConfig;

const allPaths = config.headers?.find((rule) => rule.source === '/(.*)');
const header = (key: string) => allPaths?.headers.find((h) => h.key === key)?.value;

describe('vercel.json (web-delivery: "Security and isolation headers")', () => {
  it('sends exactly the CSP the desktop app uses', () => {
    expect(header('Content-Security-Policy')).toBe(contentSecurityPolicy);
  });

  it('makes the page cross-origin isolated', () => {
    expect(header('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(header('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  });

  it('falls back to the SPA for unknown paths (web-delivery: "Routing fallback")', () => {
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('installs immutably and builds through turbo from the workspace root', () => {
    expect(config.installCommand).toBe('yarn install --immutable');
    // Yarn 4 resolves binaries per workspace; turbo lives in the root workspace.
    expect(config.buildCommand).toBe('yarn run -T turbo run build');
    expect(config.outputDirectory).toBe('dist');
  });
});
