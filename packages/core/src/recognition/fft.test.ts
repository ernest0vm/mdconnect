import { describe, expect, it } from 'vitest';

import { powerSpectrum } from './fft';

const N = 2048;

describe('powerSpectrum', () => {
  it('spreads an impulse evenly over every bin', () => {
    const impulse = new Float64Array(N);
    impulse[0] = 1;
    const power = powerSpectrum(impulse);
    expect(power).toHaveLength(N / 2 + 1);
    for (const value of power) expect(value).toBeCloseTo(1, 12);
  });

  it('puts a sine at a bin frequency into that bin only', () => {
    const bin = 100;
    const sine = Float64Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * bin * i) / N));
    const power = powerSpectrum(sine);
    expect(power[bin]).toBeCloseTo((N / 2) ** 2, 6);
    power.forEach((value, i) => {
      if (i !== bin) expect(value).toBeLessThan(1e-12);
    });
  });

  it('keeps the energy of the signal (Parseval)', () => {
    let seed = 7;
    const noise = Float64Array.from({ length: N }, () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed / 2 ** 30 - 1;
    });
    const timeEnergy = noise.reduce((sum, x) => sum + x * x, 0);
    const power = powerSpectrum(noise);
    // A real signal's spectrum is symmetric, so every bin but DC and Nyquist counts twice.
    let frequencyEnergy = (power[0] ?? 0) + (power[N / 2] ?? 0);
    for (let i = 1; i < N / 2; i++) frequencyEnergy += 2 * (power[i] ?? 0);
    expect(frequencyEnergy / N).toBeCloseTo(timeEnergy, 6);
  });

  it('refuses a length that is not a power of two', () => {
    expect(() => powerSpectrum(new Float64Array(100))).toThrow(/power of two/u);
  });
});
