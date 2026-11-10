import { describe, expect, it } from 'vitest';

import { buildLabel } from './about-view';

describe('buildLabel (app-menu: "About")', () => {
  it('shows the short commit of the build', () => {
    expect(buildLabel('0123456789abcdef0123')).toBe('Build 0123456789ab');
  });

  it('says it is a development build when there is no commit', () => {
    expect(buildLabel('')).toBe('Development build');
  });
});
