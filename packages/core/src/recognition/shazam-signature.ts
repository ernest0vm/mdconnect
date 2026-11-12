/*
 * Ported from shazam-api 0.3.0, src/algorithm.ts (`SignatureGenerator`) and
 * src/signature-format.ts (`DecodedMessage.encodeToBinary`, `encodeToUri`), by asivery,
 * GPL-2.0, https://www.npmjs.org/package/shazam-api, the library webminidisc uses.
 *
 * Changes from upstream:
 * - The FFT is `powerSpectrum` (./fft) instead of `fft.js`, and the Hanning window is computed
 *   instead of read from a table of rounded values.
 * - Samples come in as an `Int16Array`; the output is the data URI and its length in
 *   milliseconds, which is what a recognition request needs. No request code is ported.
 * - `checkShazamSignature` is new: it reads the header back so the desktop main process can refuse
 *   anything that is not a signature.
 */

import { powerSpectrum } from './fft';

/** The rate, in hertz, of the mono 16-bit samples a signature is made from. */
export const SHAZAM_SAMPLE_RATE = 16_000;

export const SHAZAM_DATA_URI_PREFIX = 'data:audio/vnd.shazam.sig;base64,';

export interface ShazamSignature {
  /** `data:audio/vnd.shazam.sig;base64,…` */
  readonly uri: string;
  /** How much audio the signature describes. */
  readonly sampleMs: number;
}

const WINDOW = 2048;
const BINS = WINDOW / 2 + 1;
const HOP = 128;
const HISTORY = 256;
/** At most this much audio, from the middle of a longer excerpt, as upstream does. */
const MAX_SAMPLES = 12 * SHAZAM_SAMPLE_RATE;

const HANNING = Float64Array.from(
  { length: WINDOW },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 1)) / (WINDOW + 1)),
);

/** Frequency bands as the format numbers them; peaks outside 250–5500 Hz are dropped. */
function bandOf(frequencyHz: number): number | null {
  if (frequencyHz < 250) return null;
  if (frequencyHz < 520) return 0;
  if (frequencyHz < 1450) return 1;
  if (frequencyHz < 3500) return 2;
  if (frequencyHz <= 5500) return 3;
  return null;
}

interface Peak {
  readonly fftPass: number;
  readonly magnitude: number;
  readonly frequencyBin: number;
}

/** Python's modulo, which is never negative. */
const wrap = (index: number, size: number) => ((index % size) + size) % size;

class Ring<T> {
  position = 0;
  constructor(readonly items: T[]) {}
  at(offset: number): T {
    return this.items[wrap(this.position + offset, this.items.length)] as T;
  }
}

/** Makes the Shazam signature of up to 12 seconds of 16 kHz mono samples. */
export function shazamSignature(samples: Int16Array): ShazamSignature {
  const excerpt = middle(samples);
  const peaks = new Map<number, Peak[]>();
  const ring = new Float64Array(WINDOW);
  let ringPosition = 0;
  const ffts = new Ring(Array.from({ length: HISTORY }, () => new Float32Array(BINS)));
  const spread = new Ring(Array.from({ length: HISTORY }, () => new Float32Array(BINS)));
  let spreadDone = 0;

  for (let start = 0; start < excerpt.length; start += HOP) {
    const batch = excerpt.subarray(start, start + HOP);
    ring.set(batch, ringPosition);
    ringPosition = (ringPosition + batch.length) % WINDOW;
    storeFft(ring, ringPosition, ffts);
    spreadPeaks(ffts, spread);
    spreadDone++;
    if (spreadDone >= 46) recognisePeaks(ffts, spread, spreadDone - 46, peaks);
  }
  return {
    uri: SHAZAM_DATA_URI_PREFIX + base64(encode(excerpt.length, peaks)),
    sampleMs: Math.round((excerpt.length / SHAZAM_SAMPLE_RATE) * 1000),
  };
}

function middle(samples: Int16Array): Int16Array {
  if (samples.length <= MAX_SAMPLES) return samples;
  const centre = Math.floor(samples.length / 2);
  return samples.subarray(centre - MAX_SAMPLES / 2, centre + MAX_SAMPLES / 2);
}

function storeFft(ring: Float64Array, ringPosition: number, ffts: Ring<Float32Array>): void {
  const frame = new Float64Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) {
    frame[i] = (ring[(ringPosition + i) % WINDOW] ?? 0) * (HANNING[i] ?? 0);
  }
  const power = powerSpectrum(frame);
  const out = ffts.at(0);
  for (let bin = 0; bin < BINS; bin++) out[bin] = Math.max(1e-10, (power[bin] ?? 0) / (1 << 17));
  ffts.position++;
}

function spreadPeaks(ffts: Ring<Float32Array>, spread: Ring<Float32Array>): void {
  const latest = spread.at(0);
  latest.set(ffts.at(-1));
  for (let bin = 0; bin <= BINS - 3; bin++) {
    latest[bin] = Math.max(latest[bin] ?? 0, latest[bin + 1] ?? 0, latest[bin + 2] ?? 0);
  }
  for (let bin = 0; bin < BINS; bin++) {
    for (const former of [-1, -3, -6]) {
      const earlier = spread.at(former);
      earlier[bin] = Math.max(earlier[bin] ?? 0, latest[bin] ?? 0);
    }
  }
  spread.position++;
}

const NEIGHBOURS = [-10, -7, -4, -3, 1, 2, 5, 8];
const OTHER_PASSES = [-53, -45, 165, 172, 179, 186, 193, 200, 214, 221, 228, 235, 242, 249];

const logMagnitude = (value: number) => Math.log(Math.max(1 / 64, value)) * 1477.3 + 6144;

function recognisePeaks(
  ffts: Ring<Float32Array>,
  spread: Ring<Float32Array>,
  fftPass: number,
  peaks: Map<number, Peak[]>,
): void {
  const candidate = ffts.at(-46);
  const spreadBefore = spread.at(-49);
  const value = (bins: Float32Array, bin: number) => bins[bin] ?? 0;
  for (let bin = 10; bin <= 1014; bin++) {
    const here = value(candidate, bin);
    if (here < 1 / 64 || here < value(spreadBefore, bin - 1)) continue;
    let loudest = 0;
    for (const offset of NEIGHBOURS) loudest = Math.max(loudest, value(spreadBefore, bin + offset));
    if (here <= loudest) continue;
    for (const offset of OTHER_PASSES)
      loudest = Math.max(loudest, value(spread.at(offset), bin - 1));
    if (here <= loudest) continue;

    const magnitude = logMagnitude(here);
    const before = logMagnitude(value(candidate, bin - 1));
    const after = logMagnitude(value(candidate, bin + 1));
    const variation = ((after - before) * 32) / (magnitude * 2 - before - after);
    const frequencyBin = ((bin * 64 + variation) & 0xffff) >>> 0;
    const band = bandOf(frequencyBin * (SHAZAM_SAMPLE_RATE / 2 / 1024 / 64));
    if (band === null) continue;
    const list = peaks.get(band) ?? [];
    list.push({ fftPass, magnitude: Math.round(magnitude) & 0xffff, frequencyBin });
    peaks.set(band, list);
  }
}

const MAGIC_1 = 0xcafe2580;
const MAGIC_2 = 0x94119c00;
const SAMPLE_RATE_ID = 3 << 27;
const FIXED_VALUE = (15 << 19) + 0x40000;
const HEADER_BYTES = 48;
const BAND_BASE = 0x60030040;
/** The format adds this much to the sample count (0.24 s at 16 kHz). */
const SAMPLE_OFFSET = Math.round(SHAZAM_SAMPLE_RATE * 0.24);

function encode(sampleCount: number, peaks: Map<number, Peak[]>): Uint8Array {
  const contents = new ByteWriter();
  for (const [band, list] of [...peaks].sort(([a], [b]) => a - b)) {
    const bandPeaks = new ByteWriter();
    let pass = 0;
    for (const peak of list) {
      if (peak.fftPass - pass >= 0xff) {
        bandPeaks.byte(0xff);
        bandPeaks.int32(peak.fftPass);
        pass = peak.fftPass;
      }
      bandPeaks.byte(peak.fftPass - pass);
      // Upstream writes both values less one; the service accepts what it sends.
      bandPeaks.int16(peak.magnitude - 1);
      bandPeaks.int16(peak.frequencyBin - 1);
      pass = peak.fftPass;
    }
    contents.int32(BAND_BASE + band);
    contents.int32(bandPeaks.length);
    contents.bytes(bandPeaks.toBytes());
    contents.pad();
  }

  const body = new ByteWriter();
  body.int32(contents.length + 8);
  body.int32(MAGIC_2);
  for (let i = 0; i < 3; i++) body.int32(0);
  body.int32(SAMPLE_RATE_ID);
  for (let i = 0; i < 2; i++) body.int32(0);
  body.int32(sampleCount + SAMPLE_OFFSET);
  body.int32(FIXED_VALUE);
  body.int32(0x40000000);
  body.int32(contents.length + 8);
  body.bytes(contents.toBytes());
  const checked = body.toBytes();

  const out = new ByteWriter();
  out.int32(MAGIC_1);
  out.int32(crc32(checked));
  out.bytes(checked);
  return out.toBytes();
}

class ByteWriter {
  private readonly out: number[] = [];
  get length(): number {
    return this.out.length;
  }
  byte(value: number): void {
    this.out.push(value & 0xff);
  }
  int16(value: number): void {
    this.byte(value);
    this.byte(value >> 8);
  }
  int32(value: number): void {
    for (let shift = 0; shift < 32; shift += 8) this.byte(value >> shift);
  }
  bytes(values: Uint8Array): void {
    for (const value of values) this.out.push(value);
  }
  /** Pads to a multiple of four bytes. */
  pad(): void {
    while (this.out.length % 4 !== 0) this.out.push(0);
  }
  toBytes(): Uint8Array {
    return Uint8Array.from(this.out);
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64[(triple >> 18) & 63] ?? '';
    out += BASE64[(triple >> 12) & 63] ?? '';
    out += b === undefined ? '=' : (BASE64[(triple >> 6) & 63] ?? '');
    out += c === undefined ? '=' : (BASE64[triple & 63] ?? '');
  }
  return out;
}

function fromBase64(text: string): Uint8Array | null {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(text)) return null;
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    // The text is checked to be base64 above, so every character is one UTF-16 unit.
    const values = Array.from({ length: 4 }, (_, k) => {
      const char = text.charAt(i + k);
      return char === '=' ? -1 : BASE64.indexOf(char);
    });
    const [a = 0, b = 0, c = -1, d = -1] = values;
    out.push(((a << 2) | (b >> 4)) & 0xff);
    if (c >= 0) out.push(((b << 4) | (c >> 2)) & 0xff);
    if (d >= 0) out.push(((c << 6) | d) & 0xff);
  }
  return Uint8Array.from(out);
}

/** The longest excerpt the desktop app sends to Shazam. */
export const MAX_SHAZAM_SAMPLE_MS = 15_000;

/**
 * Whether `uri` is a well-formed signature of at most 15 seconds whose header says `sampleMs`:
 * the data URI prefix, both magic numbers, the 16 kHz rate, the sizes and the CRC. The desktop
 * main process sends nothing to Shazam that fails this.
 */
export function checkShazamSignature(uri: unknown, sampleMs: unknown): boolean {
  if (typeof uri !== 'string' || !uri.startsWith(SHAZAM_DATA_URI_PREFIX)) return false;
  if (typeof sampleMs !== 'number' || !Number.isInteger(sampleMs)) return false;
  if (sampleMs <= 0 || sampleMs > MAX_SHAZAM_SAMPLE_MS) return false;
  const bytes = fromBase64(uri.slice(SHAZAM_DATA_URI_PREFIX.length));
  if (bytes === null || bytes.length < HEADER_BYTES + 8) return false;
  const view = new DataView(bytes.buffer);
  const word = (offset: number) => view.getUint32(offset, true);
  const samples = word(40) - SAMPLE_OFFSET;
  return (
    word(0) === MAGIC_1 &&
    word(4) === crc32(bytes.subarray(8)) &&
    word(8) === bytes.length - HEADER_BYTES &&
    word(12) === MAGIC_2 &&
    word(28) === SAMPLE_RATE_ID &&
    samples > 0 &&
    samples <= (MAX_SHAZAM_SAMPLE_MS / 1000) * SHAZAM_SAMPLE_RATE &&
    Math.round((samples / SHAZAM_SAMPLE_RATE) * 1000) === sampleMs
  );
}
