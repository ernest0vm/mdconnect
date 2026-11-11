/*
 * Ported from webminidisc, src/utils.ts (`getATRACWAVEncoding`, `getATRACOMAEncoding`),
 * https://github.com/asivery/webminidisc, by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - Returns the NetMD mode and the audio bytes (the WAV `data` chunk only) instead of a codec and
 *   a header length. ATRAC3plus, which NetMD cannot take, is reported as unsupported.
 * - An OMA whose codec the platform decoder may handle (MP3, LPCM, WMA) is left to it, as upstream
 *   leaves it to ffmpeg.
 */

import type { UploadMode } from '@mdconnect/netmd';

export type AtracFile =
  | { readonly kind: 'atrac'; readonly mode: UploadMode; readonly data: Uint8Array }
  | { readonly kind: 'encrypted' }
  | { readonly kind: 'unsupported' };

const WAV_FORMAT_ATRAC3 = 0x0270;
const WAV_FORMAT_EXTENSIBLE = 0xfffe;
const SAMPLE_RATE = 44_100;
const EA3_HEADER_LENGTH = 96;

/** Frame size (bytes per channel pair, halved) in an ATRAC3 WAV, by mode. */
const WAV_FRAME_MODES: Readonly<Record<number, UploadMode>> = {
  192: 'lp2',
  152: 'lp105',
  96: 'lp4',
};

const text = (data: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...data.subarray(start, start + length));

/**
 * Recognises ATRAC3 audio that can be uploaded as is: an ATRAC3 WAV or an unencrypted OMA at LP2,
 * LP105 or LP4. Returns null for anything else, which is then decoded like any audio file.
 */
export function readAtracFile(data: Uint8Array): AtracFile | null {
  return readAtracWav(data) ?? readOma(data);
}

/** The mode of an ATRAC3 WAV, read from its `fmt ` chunk, or null for any other file. */
function atracWavMode(data: Uint8Array): UploadMode | null {
  if (data.length < 44 || text(data, 0, 4) !== 'RIFF' || text(data, 8, 8) !== 'WAVEfmt ') {
    return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const format = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  if ((format !== WAV_FORMAT_ATRAC3 && format !== WAV_FORMAT_EXTENSIBLE) || channels !== 2) {
    return null;
  }
  if (view.getUint32(24, true) !== SAMPLE_RATE) return null;
  return WAV_FRAME_MODES[view.getUint16(32, true) / 2] ?? null;
}

function readAtracWav(data: Uint8Array): AtracFile | null {
  const mode = atracWavMode(data);
  if (mode === null) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let offset = 12; offset + 8 <= data.length;) {
    const size = view.getUint32(offset + 4, true);
    if (text(data, offset, 4) === 'data') {
      const start = offset + 8;
      return {
        kind: 'atrac',
        mode,
        data: data.subarray(start, Math.min(start + size, data.length)),
      };
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

function readOma(data: Uint8Array): AtracFile | null {
  let offset = 0;
  if (text(data, 0, 3) === 'ea3') {
    const tagLength =
      (((data[6] ?? 0) & 0x7f) << 21) |
      (((data[7] ?? 0) & 0x7f) << 14) |
      (((data[8] ?? 0) & 0x7f) << 7) |
      ((data[9] ?? 0) & 0x7f);
    offset = tagLength + 10 + (((data[5] ?? 0) & 0x10) === 0 ? 0 : 10);
  }
  const header = data.subarray(offset, offset + EA3_HEADER_LENGTH);
  if (header.length < EA3_HEADER_LENGTH || text(header, 0, 4) !== 'EA3\x01') return null;
  if (header[5] !== EA3_HEADER_LENGTH) return null;

  const encryption = ((header[6] ?? 0) << 8) | (header[7] ?? 0);
  if (encryption !== 0xffff && encryption !== 0xff80) return { kind: 'encrypted' };
  const codec = header[32] ?? 0;
  // MP3, LPCM and WMA inside an OMA go to the platform decoder.
  if ([3, 4, 5].includes(codec)) return null;
  if (codec !== 0) return { kind: 'unsupported' };

  const info = ((header[33] ?? 0) << 16) | ((header[34] ?? 0) << 8) | (header[35] ?? 0);
  const sampleRates = [32_000, 44_100, 48_000, 88_200, 96_000];
  if (sampleRates[(info >> 13) & 7] !== SAMPLE_RATE) return { kind: 'unsupported' };
  const frameSize = (info & 0x3ff) * 8;
  const jointStereo = ((info >> 17) & 1) === 1;
  const mode = omaMode(frameSize, jointStereo);
  if (mode === null) return { kind: 'unsupported' };
  return { kind: 'atrac', mode, data: data.subarray(offset + EA3_HEADER_LENGTH) };
}

function omaMode(frameSize: number, jointStereo: boolean): UploadMode | null {
  if (frameSize === 384 && !jointStereo) return 'lp2';
  if (frameSize === 304 && !jointStereo) return 'lp105';
  if (frameSize === 192 && jointStereo) return 'lp4';
  return null;
}

/** Enough of a file to tell whether it is ATRAC3, and in which mode. */
const HEADER_PROBE_BYTES = 64 * 1024;

/**
 * `readAtracFile` for a file on disk. It reads the start of the file first and the whole file
 * only when that start shows ATRAC3, including an ATRAC3 WAV whose metadata pushes its audio past
 * the first 64 KiB.
 */
export async function readAtracBlob(file: Blob): Promise<AtracFile | null> {
  const header = new Uint8Array(await file.slice(0, HEADER_PROBE_BYTES).arrayBuffer());
  const probe = readAtracFile(header);
  if (probe !== null && probe.kind !== 'atrac') return probe;
  if (probe === null && atracWavMode(header) === null) return null;
  return readAtracFile(new Uint8Array(await file.arrayBuffer()));
}
