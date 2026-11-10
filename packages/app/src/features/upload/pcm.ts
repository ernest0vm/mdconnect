/** Sample rate every NetMD upload uses. */
export const SAMPLE_RATE = 44_100;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const WAV_HEADER_LENGTH = 44;

export interface Interleave16Options {
  /** Linear gain applied before clipping (1 leaves the audio as is). */
  readonly gain: number;
  /** Big-endian for SP uploads; little-endian for a WAV. */
  readonly bigEndian: boolean;
  /** Bytes left free at the start of the output, for a header. */
  readonly offset?: number;
}

/** Interleaves two float channels (-1 to 1) into 16-bit PCM, clipping past full scale. */
export function interleave16(
  left: Float32Array,
  right: Float32Array,
  options: Interleave16Options,
): Uint8Array<ArrayBuffer> {
  const frames = Math.min(left.length, right.length);
  const offset = options.offset ?? 0;
  const out = new Uint8Array(offset + frames * CHANNELS * BYTES_PER_SAMPLE);
  const view = new DataView(out.buffer);
  const littleEndian = !options.bigEndian;
  for (let i = 0; i < frames; i++) {
    view.setInt16(offset + i * 4, toInt16((left[i] ?? 0) * options.gain), littleEndian);
    view.setInt16(offset + i * 4 + 2, toInt16((right[i] ?? 0) * options.gain), littleEndian);
  }
  return out;
}

function toInt16(sample: number): number {
  const clipped = Math.max(-1, Math.min(1, sample));
  return Math.round(clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff);
}

/** The largest absolute sample in either channel. */
export function peakOf(left: Float32Array, right: Float32Array): number {
  let peak = 0;
  for (const channel of [left, right]) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

/**
 * The linear factor for a ReplayGain track gain, limited so the loudest sample (`peak`) does not
 * clip. No tag means no change.
 */
export function replayGainFactor(gainDb: number | undefined, peak: number): number {
  if (gainDb === undefined) return 1;
  const factor = 10 ** (gainDb / 20);
  return peak > 0 ? Math.min(factor, 1 / peak) : factor;
}

/**
 * Two float channels as a 16-bit stereo WAV at 44.1 kHz, written in one buffer (no copy of the
 * samples to add the header).
 */
export function wavFile(
  left: Float32Array,
  right: Float32Array,
  gain: number,
): Uint8Array<ArrayBuffer> {
  const out = interleave16(left, right, { gain, bigEndian: false, offset: WAV_HEADER_LENGTH });
  const length = out.length - WAV_HEADER_LENGTH;
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, WAV_HEADER_LENGTH - 8 + length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, length, true);
  return out;
}
