import { describe, expect, it } from 'vitest';

import { percentText } from './percent';

describe('percentText', () => {
  it('rounds a share to a whole percentage, of 1 by default', () => {
    expect(percentText(0.426)).toBe('43%');
    expect(percentText(50, 200)).toBe('25%');
    expect(percentText(5, 0)).toBe('0%');
  });
});
