import { readFileSync } from 'node:fs';

import { contentSecurityPolicy } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

interface VercelConfig {
  readonly headers: readonly {
    readonly source: string;
    readonly headers: readonly { readonly key: string; readonly value: string }[];
  }[];
}

const config = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig;

describe('vercel.json (web-delivery: "Security and isolation headers")', () => {
  it('sends the shared Content Security Policy unchanged', () => {
    const sent = config.headers
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === 'Content-Security-Policy');
    expect(sent?.value).toBe(contentSecurityPolicy);
  });
});
