import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from './security';

const directives = new Map(
  contentSecurityPolicy.split(';').map((part) => {
    const [name = '', ...values] = part.trim().split(/\s+/);
    return [name, values] as const;
  }),
);

describe('contentSecurityPolicy', () => {
  it('only runs scripts shipped with the app, plus WebAssembly', () => {
    expect(directives.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  });

  it('connects only to the app, the online ATRAC encoder and the recognition services (desktop-shell: "Recognition services allowed", "Other origins blocked")', () => {
    expect(directives.get('connect-src')).toEqual([
      "'self'",
      'https://atrac.minidisc.wiki',
      'https://api.acoustid.org',
      'https://musicbrainz.org',
    ]);
  });

  it('never allows string evaluation', () => {
    expect(contentSecurityPolicy).not.toContain("'unsafe-eval'");
  });

  it('blocks plugins, base-URI changes, form posts and framing', () => {
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'none'"]);
    expect(directives.get('form-action')).toEqual(["'none'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
  });
});
