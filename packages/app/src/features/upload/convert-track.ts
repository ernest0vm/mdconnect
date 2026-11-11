import type { UploadMode } from '@mdconnect/netmd';

import { readAtracBlob } from './atrac-file';
import { decodeAudio, NotDecodableError, type DecodedAudio } from './decode';
import {
  BuiltInEncoder,
  encodeOnline,
  OnlineEncoderUnavailableError,
  type LpMode,
} from './encoders';
import { interleave16, peakOf, replayGainFactor, wavFile } from './pcm';

/** The recording modes the convert dialog offers; LP105 only comes from ATRAC3 files. */
export type RecordingMode = 'sp' | 'spMono' | 'lp2' | 'lp4';

export type Encoder = 'built-in' | 'online';

export interface ConvertOptions {
  /** Which LP encoder to use; ignored for SP. */
  readonly encoder: Encoder;
  readonly replayGain: boolean;
  /** The file's ReplayGain track gain, from its tags. */
  readonly trackGainDb: number | undefined;
  /** Stops an encoder that is running; the upload aborts it when it stops early. */
  readonly signal?: AbortSignal | undefined;
}

/** A track ready for `UploadSession.uploadTrack`: audio in its mode's wire format. */
export interface ConvertedTrack {
  readonly mode: UploadMode;
  readonly data: Uint8Array;
}

export type ConversionFailure =
  | 'unreadable'
  | 'not-decodable'
  | 'not-supported'
  | 'online-encoder-unavailable'
  | 'encoder-failed'
  | 'empty';

/** A track that could not be converted; the upload skips it and says why. */
export class ConversionError extends Error {
  constructor(
    readonly reason: ConversionFailure,
    options?: ErrorOptions,
  ) {
    super(`The track could not be converted (${reason})`, options);
    this.name = 'ConversionError';
  }
}

export interface ConvertDependencies {
  readonly decode: (file: ArrayBuffer) => Promise<DecodedAudio>;
  /** Encodes a 16-bit stereo WAV (see `wavFile`). */
  readonly builtIn: (
    wav: Uint8Array<ArrayBuffer>,
    mode: LpMode,
    signal?: AbortSignal,
  ) => Promise<Uint8Array>;
  readonly online: (
    file: File,
    fileName: string,
    mode: LpMode,
    options: { readonly replayGain: boolean; readonly signal?: AbortSignal | undefined },
  ) => Promise<{ readonly mode: UploadMode; readonly data: Uint8Array }>;
}

const builtInEncoder = new BuiltInEncoder();
const browserDependencies: ConvertDependencies = {
  decode: (file) => decodeAudio(file),
  builtIn: (wav, mode, signal) => builtInEncoder.encode(wav, mode, signal),
  online: (file, fileName, mode, options) => encodeOnline(file, fileName, mode, options),
};

/** Enough of a file to recognise an ATRAC3 WAV or OMA header without reading all of it. */

/**
 * Turns a file into data for the deck. ATRAC3 files are uploaded as they are, in their own mode.
 * Otherwise SP is PCM the deck encodes, and LP2 or LP4 is encoded by the chosen encoder.
 */
export async function convertTrack(
  file: File,
  mode: RecordingMode,
  options: ConvertOptions,
  dependencies: ConvertDependencies = browserDependencies,
): Promise<ConvertedTrack> {
  try {
    return await convert(file, mode, options, dependencies);
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    throw new ConversionError(failureOf(error), { cause: error });
  }
}

async function convert(
  file: File,
  mode: RecordingMode,
  options: ConvertOptions,
  dependencies: ConvertDependencies,
): Promise<ConvertedTrack> {
  const atrac = await readAtracBlob(file);
  if (atrac?.kind === 'atrac') return { mode: atrac.mode, data: atrac.data };
  if (atrac !== null) throw new ConversionError('not-supported');

  const lp = mode === 'lp2' || mode === 'lp4';
  if (lp && options.encoder === 'online') {
    // The file goes out as it is; the service sends back the mode it encoded.
    return dependencies.online(file, file.name, mode, {
      replayGain: options.replayGain,
      signal: options.signal,
    });
  }
  const audio = await dependencies.decode(await file.arrayBuffer());
  if (audio.left.length === 0) throw new ConversionError('empty');
  const gain = options.replayGain
    ? replayGainFactor(options.trackGainDb, peakOf(audio.left, audio.right))
    : 1;
  if (lp) {
    const wav = wavFile(audio.left, audio.right, gain);
    return { mode, data: await dependencies.builtIn(wav, mode, options.signal) };
  }
  return { mode, data: interleave16(audio.left, audio.right, { gain, bigEndian: true }) };
}

function failureOf(error: unknown): ConversionFailure {
  // The file was moved, deleted or became unreadable after it was picked.
  if (error instanceof DOMException && ['NotReadableError', 'NotFoundError'].includes(error.name)) {
    return 'unreadable';
  }
  if (error instanceof NotDecodableError) return 'not-decodable';
  if (error instanceof OnlineEncoderUnavailableError) return 'online-encoder-unavailable';
  return 'encoder-failed';
}
