import { describe, expect, it } from 'vitest';

import { buildCsp, CSP_DIRECTIVES, contentSecurityPolicy } from './security';

describe('buildCsp', () => {
  it('joins directives in order', () => {
    expect(buildCsp({ 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'] })).toBe(
      "default-src 'self'; img-src 'self' data:",
    );
  });

  it('produces the production policy from CSP_DIRECTIVES', () => {
    expect(contentSecurityPolicy).toBe(buildCsp(CSP_DIRECTIVES));
  });
});
