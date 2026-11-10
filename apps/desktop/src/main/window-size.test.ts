import { describe, expect, it } from 'vitest';

import { mainWindowSize } from './window-size';

describe('mainWindowSize (app-layout: "First open", "Resize")', () => {
  it('opens at 1200 × 800 when the screen has room', () => {
    expect(mainWindowSize({ width: 1440, height: 875 })).toEqual({
      width: 1200,
      height: 800,
      minWidth: 480,
      minHeight: 560,
    });
  });

  it('fits a smaller work area, never below the minimum', () => {
    expect(mainWindowSize({ width: 1024, height: 700 })).toMatchObject({
      width: 1024,
      height: 700,
    });
    expect(mainWindowSize({ width: 400, height: 500 })).toMatchObject({ width: 480, height: 560 });
  });
});
