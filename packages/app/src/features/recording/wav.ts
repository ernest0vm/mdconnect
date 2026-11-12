const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

/**
 * Captured audio for one track, kept as interleaved 16-bit samples: half the memory of the float
 * blocks it is built from, which matters for tracks of an hour or more.
 */
export class PcmBuffer {
  private readonly chunks: Int16Array[] = [];
  private length = 0;
  /** The loudest sample so far, from 0 to 1 (or more when the input clipped). */
  peak = 0;

  constructor(readonly channels: number) {}

  /** Frames (samples per channel) appended so far. */
  get frames(): number {
    return this.length / this.channels;
  }

  /** Whether any sample went past full scale. */
  get clipped(): boolean {
    return this.peak > 1;
  }

  /** Appends one block: one float array per channel, all of the same length. */
  append(block: readonly Float32Array[]): void {
    const frames = block[0]?.length ?? 0;
    const chunk = new Int16Array(frames * this.channels);
    for (let channel = 0; channel < this.channels; channel += 1) {
      const samples = block[channel] ?? block[0] ?? new Float32Array(frames);
      for (let frame = 0; frame < frames; frame += 1) {
        const sample = samples[frame] ?? 0;
        this.peak = Math.max(this.peak, Math.abs(sample));
        chunk[frame * this.channels + channel] = toInt16(sample);
      }
    }
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  /** Every sample appended, interleaved by channel. */
  samples(): Int16Array {
    const all = new Int16Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    return all;
  }
}

/** A float sample from -1 to 1 as a 16-bit integer, clamped to the integer range. */
function toInt16(sample: number): number {
  return Math.max(-32_768, Math.min(32_767, Math.round(sample * 32_768)));
}

/** A 16-bit PCM WAV file: the 44-byte RIFF header, then the interleaved samples. */
export function encodeWav(
  samples: Int16Array,
  sampleRate: number,
  channels: number,
): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const wav = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(wav.buffer);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  ascii(0, 'RIFF');
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * BYTES_PER_SAMPLE, true);
  view.setUint16(32, channels * BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(HEADER_BYTES + index * BYTES_PER_SAMPLE, samples[index] ?? 0, true);
  }
  return wav;
}
