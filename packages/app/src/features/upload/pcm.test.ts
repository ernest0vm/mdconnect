import { describe, expect, it } from 'vitest';

import { interleave16, peakOf, replayGainFactor, wavFile } from './pcm';

const f32 = (...values: number[]) => new Float32Array(values);

describe('interleave16', () => {
  it('interleaves both channels as big-endian 16-bit samples for SP (audio-conversion: "SP audio")', () => {
    const pcm = interleave16(f32(1, -1), f32(0, 0.5), { gain: 1, bigEndian: true });
    expect([...pcm]).toEqual([0x7f, 0xff, 0x00, 0x00, 0x80, 0x00, 0x40, 0x00]);
  });

  it('writes little-endian samples for a WAV', () => {
    const pcm = interleave16(f32(1), f32(-1), { gain: 1, bigEndian: false });
    expect([...pcm]).toEqual([0xff, 0x7f, 0x00, 0x80]);
  });

  it('applies the gain and clips anything past full scale', () => {
    const pcm = interleave16(f32(0.5, 0.9), f32(-0.5, -0.9), { gain: 2, bigEndian: true });
    const view = new DataView(pcm.buffer);
    expect([0, 2, 4, 6].map((o) => view.getInt16(o))).toEqual([32767, -32768, 32767, -32768]);
  });
});

describe('replayGainFactor', () => {
  it('turns -6 dB into about half the amplitude (audio-conversion: "Apply track gain")', () => {
    expect(replayGainFactor(-6, 1)).toBeCloseTo(0.501, 3);
  });

  it('leaves a file without the tag unchanged (audio-conversion: "No tag")', () => {
    expect(replayGainFactor(undefined, 0.5)).toBe(1);
  });

  it('limits a positive gain so the peak does not clip', () => {
    expect(replayGainFactor(10, 0.8)).toBeCloseTo(1.25, 6);
  });

  it('applies a positive gain fully when there is headroom', () => {
    expect(replayGainFactor(3, 0.1)).toBeCloseTo(1.413, 3);
  });
});

describe('peakOf', () => {
  it('is the largest absolute sample in either channel', () => {
    expect(peakOf(f32(0.1, -0.7), f32(0.5))).toBeCloseTo(0.7, 6);
  });
});

describe('wavFile', () => {
  it('wraps 16-bit stereo PCM in a 44.1 kHz WAV header', () => {
    const wav = wavFile(new Uint8Array(8));
    const view = new DataView(wav.buffer);
    const text = (start: number) => String.fromCharCode(...wav.subarray(start, start + 4));
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(view.getUint32(4, true)).toBe(36 + 8);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint32(28, true)).toBe(44_100 * 4);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(wav).toHaveLength(44 + 8);
  });
});
