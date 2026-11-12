import { describe, expect, it } from 'vitest';

import { SWEEPS_SIGNATURE_URI } from './fixtures/sweeps-signature';
import {
  checkShazamSignature,
  MAX_SHAZAM_SAMPLE_MS,
  SHAZAM_DATA_URI_PREFIX,
  SHAZAM_SAMPLE_RATE,
  shazamSignature,
} from './shazam-signature';

/** Twelve seconds of two crossing sine sweeps at 16 kHz: synthetic, so no recording is committed. */
function sweeps(): Int16Array {
  const length = 12 * SHAZAM_SAMPLE_RATE;
  const out = new Int16Array(length);
  let phaseA = 0;
  let phaseB = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SHAZAM_SAMPLE_RATE;
    phaseA += (2 * Math.PI * (300 + 2700 * (t / 12))) / SHAZAM_SAMPLE_RATE;
    phaseB += (2 * Math.PI * (4000 - 3400 * (t / 12))) / SHAZAM_SAMPLE_RATE;
    out[i] = Math.round(8000 * Math.sin(phaseA) + 6000 * Math.sin(phaseB));
  }
  return out;
}

describe('shazamSignature', () => {
  it('gives the signature shazam-api gives for the same samples (song-recognition: "Shazam request")', () => {
    const signature = shazamSignature(sweeps());
    expect(signature.uri).toBe(SWEEPS_SIGNATURE_URI);
    expect(signature.sampleMs).toBe(12_000);
  });

  it('carries only the signature, not the samples', () => {
    const { uri } = shazamSignature(sweeps());
    // 12 s of 16-bit samples is 384,000 bytes; the signature is a few kilobytes.
    expect(uri.length).toBeLessThan(10_000);
  });

  it('uses the middle 12 seconds of a longer excerpt, as shazam-api does', () => {
    const long = new Int16Array(16 * SHAZAM_SAMPLE_RATE);
    long.set(sweeps(), 2 * SHAZAM_SAMPLE_RATE);
    expect(shazamSignature(long).uri).toBe(SWEEPS_SIGNATURE_URI);
  });
});

describe('checkShazamSignature (desktop-shell: "Malformed request")', () => {
  const valid = () => shazamSignature(sweeps());

  it('accepts a signature with the length it describes', () => {
    const { uri, sampleMs } = valid();
    expect(checkShazamSignature(uri, sampleMs)).toBe(true);
  });

  it('refuses a signature whose CRC does not match', () => {
    const { uri, sampleMs } = valid();
    // The last base64 characters are padding-free content; changing one breaks the checksum.
    const tampered = uri.slice(0, -6) + (uri.at(-6) === 'A' ? 'B' : 'A') + uri.slice(-5);
    expect(checkShazamSignature(tampered, sampleMs)).toBe(false);
  });

  it('refuses other data and other types', () => {
    expect(checkShazamSignature('https://example.com/', 12_000)).toBe(false);
    expect(checkShazamSignature(`${SHAZAM_DATA_URI_PREFIX}aGVsbG8=`, 12_000)).toBe(false);
    expect(checkShazamSignature(`${SHAZAM_DATA_URI_PREFIX}!!!!`, 12_000)).toBe(false);
    expect(checkShazamSignature(42, 12_000)).toBe(false);
    expect(checkShazamSignature(valid().uri, '12000')).toBe(false);
  });

  it('refuses a length that differs from the signature', () => {
    expect(checkShazamSignature(valid().uri, 11_000)).toBe(false);
  });

  it('refuses a signature longer than 15 seconds', () => {
    const { uri } = valid();
    expect(checkShazamSignature(uri, 16_000)).toBe(false);
    expect(checkShazamSignature(uri, MAX_SHAZAM_SAMPLE_MS + 1)).toBe(false);
  });
});
