/**
 * The power spectrum of a real frame, |X[k]|² for k from 0 to n/2, by an iterative radix-2 FFT.
 * The Shazam signature needs only these values, so the complex output is not returned. The frame
 * length must be a power of two.
 */
export function powerSpectrum(frame: Float64Array): Float64Array {
  const n = frame.length;
  if (n === 0 || (n & (n - 1)) !== 0) throw new Error('The frame length must be a power of two');
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
  reorderByReversedBits(re, n);
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const step = (-2 * Math.PI) / size;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(step * k);
      const wi = Math.sin(step * k);
      for (let start = 0; start < n; start += size) {
        const even = start + k;
        const odd = even + half;
        const oddRe = at(re, odd);
        const oddIm = at(im, odd);
        const tr = wr * oddRe - wi * oddIm;
        const ti = wr * oddIm + wi * oddRe;
        re[odd] = at(re, even) - tr;
        im[odd] = at(im, even) - ti;
        re[even] = at(re, even) + tr;
        im[even] = at(im, even) + ti;
      }
    }
  }
  return Float64Array.from({ length: n / 2 + 1 }, (_, k) => at(re, k) ** 2 + at(im, k) ** 2);
}

function reorderByReversedBits(values: Float64Array, n: number): void {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const swap = at(values, i);
      values[i] = at(values, j);
      values[j] = swap;
    }
  }
}

/** Reads an index the loops keep in range; `noUncheckedIndexedAccess` cannot see that. */
const at = (values: Float64Array, index: number): number => values[index] ?? 0;
