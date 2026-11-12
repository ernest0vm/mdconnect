/** A share of `max` as a whole percentage, such as `42%`; 0% when `max` is not positive. */
export const percentText = (value: number, max = 1): string =>
  `${String(Math.round(max > 0 ? (value / max) * 100 : 0))}%`;
