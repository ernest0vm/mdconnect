const PREFERRED = { width: 1200, height: 800 } as const;
const MINIMUM = { width: 480, height: 560 } as const;

export interface WindowSize {
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
}

/**
 * The main window's size: 1200 × 800, or the screen's work area when that is smaller, but never
 * below 480 × 560, the smallest size the layout is designed for.
 */
export function mainWindowSize(workArea: { width: number; height: number }): WindowSize {
  return {
    width: Math.max(MINIMUM.width, Math.min(PREFERRED.width, workArea.width)),
    height: Math.max(MINIMUM.height, Math.min(PREFERRED.height, workArea.height)),
    minWidth: MINIMUM.width,
    minHeight: MINIMUM.height,
  };
}
