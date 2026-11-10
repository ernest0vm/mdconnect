const PREFERRED = { width: 1200, height: 800 } as const;
const MINIMUM = { width: 480, height: 560 } as const;

export interface WindowSize {
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
}

/**
 * The main window's size: 1200 × 800, or the screen's work area when that is smaller. The
 * minimum is 480 × 560, the smallest size the layout is designed for, except on a work area
 * smaller than that: then the window and its minimum fit the work area, so no part of it is
 * off screen and out of reach.
 */
export function mainWindowSize(workArea: { width: number; height: number }): WindowSize {
  const minWidth = Math.min(MINIMUM.width, workArea.width);
  const minHeight = Math.min(MINIMUM.height, workArea.height);
  return {
    width: Math.max(minWidth, Math.min(PREFERRED.width, workArea.width)),
    height: Math.max(minHeight, Math.min(PREFERRED.height, workArea.height)),
    minWidth,
    minHeight,
  };
}
