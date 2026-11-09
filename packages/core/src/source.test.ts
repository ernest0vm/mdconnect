import { describe, expect, it } from 'vitest';

import { licenseName, sourceLink, sourceRepositoryUrl } from './source';

describe('source availability (web-delivery: "Source availability")', () => {
  it('points at the GitHub repository', () => {
    expect(sourceRepositoryUrl).toBe('https://github.com/ernest0vm/mdconnect');
  });

  it('names the GPL-2.0 license', () => {
    expect(licenseName).toBe('GPL-2.0');
  });

  it('links to the exact commit a build was made from', () => {
    expect(sourceLink('abc123')).toBe('https://github.com/ernest0vm/mdconnect/tree/abc123');
  });

  it('falls back to the repository root when the commit is unknown', () => {
    expect(sourceLink('')).toBe('https://github.com/ernest0vm/mdconnect');
  });
});
