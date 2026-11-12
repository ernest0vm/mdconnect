import { describe, expect, it } from 'vitest';

import { encodeWav, PcmBuffer } from './wav';

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

describe('PcmBuffer', () => {
  it('interleaves the channels of each block as 16-bit samples, in order', () => {
    const pcm = new PcmBuffer(2);
    pcm.append([new Float32Array([0, 0.5]), new Float32Array([-0.5, 1])]);
    pcm.append([new Float32Array([-1]), new Float32Array([0.25])]);
    expect(pcm.frames).toBe(3);
    expect([...pcm.samples()]).toEqual([0, -16384, 16384, 32767, -32768, 8192]);
  });

  it('clips samples outside -1…1 and reports the clip', () => {
    const pcm = new PcmBuffer(1);
    pcm.append([new Float32Array([1.5, -2, 0.1])]);
    expect([...pcm.samples()]).toEqual([32767, -32768, 3277]);
    expect(pcm.clipped).toBe(true);
  });

  it('records the peak level of the audio so far', () => {
    const pcm = new PcmBuffer(1);
    pcm.append([new Float32Array([0.1, -0.4, 0.2])]);
    expect(pcm.peak).toBeCloseTo(0.4);
    expect(pcm.clipped).toBe(false);
  });

  it('copies a mono input to its single channel', () => {
    const pcm = new PcmBuffer(1);
    pcm.append([new Float32Array([0.5])]);
    expect([...pcm.samples()]).toEqual([16384]);
  });
});

describe('encodeWav (deck-recording: "One track")', () => {
  it('writes a 16-bit PCM RIFF header for the rate and channels, then the samples', () => {
    const wav = encodeWav(new Int16Array([1, -1, 2, -2]), 48_000, 2);
    const view = new DataView(wav.buffer);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 8);
    expect(ascii(wav, 8, 8)).toBe('WAVEfmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(48_000 * 4); // byte rate
    expect(view.getUint16(32, true)).toBe(4); // block align
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBe(1);
    expect(view.getInt16(46, true)).toBe(-1);
    expect(wav.length).toBe(52);
  });
});
