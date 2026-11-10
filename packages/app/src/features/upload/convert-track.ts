import type { UploadMode } from '@mdconnect/netmd';

import { readAtracFile } from './atrac-file';
import { decodeAudio, NotDecodableError, type DecodedAudio } from './decode';
import {
  BuiltInEncoder,
  encodeOnline,
  OnlineEncoderUnavailableError,
  type LpMode,
} from './encoders';
import { interleave16, peakOf, replayGainFactor } from './pcm';

/** The recording modes the convert dialog offers; LP105 only comes from ATRAC3 files. */
export type RecordingMode = 'sp' | 'spMono' | 'lp2' | 'lp4';

export type Encoder = 'built-in' | 'online';

export interface ConvertOptions {
  /** Which LP encoder to use; ignored for SP. */
  readonly encoder: Encoder;
  readonly replayGain: boolean;
  /** The file's ReplayGain track gain, from its tags. */
  readonly trackGainDb: number | undefined;
}

/** A track ready for `UploadSession.uploadTrack`: audio in its mode's wire format. */
export interface ConvertedTrack {
  readonly mode: UploadMode;
  readonly data: Uint8Array;
}

export type ConversionFailure =
  'not-decodable' | 'not-supported' | 'online-encoder-unavailable' | 'encoder-failed' | 'empty';

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
  readonly builtIn: (pcm: Uint8Array, mode: LpMode) => Promise<Uint8Array>;
  readonly online: typeof encodeOnline;
}

const builtInEncoder = new BuiltInEncoder();
const browserDependencies: ConvertDependencies = {
  decode: (file) => decodeAudio(file),
  builtIn: (pcm, mode) => builtInEncoder.encode(pcm, mode),
  online: encodeOnline,
};

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
  const bytes = await file.arrayBuffer();
  const atrac = readAtracFile(new Uint8Array(bytes));
  if (atrac?.kind === 'atrac') return { mode: atrac.mode, data: atrac.data };
  if (atrac !== null) throw new ConversionError('not-supported');

  if (mode === 'lp2' || mode === 'lp4') {
    if (options.encoder === 'online') {
      const data = await dependencies.online(file, file.name, mode, {
        replayGain: options.replayGain,
      });
      return { mode, data };
    }
    const pcm = pcmOf(await dependencies.decode(bytes), options, false);
    return { mode, data: await dependencies.builtIn(pcm, mode) };
  }
  return { mode, data: pcmOf(await dependencies.decode(bytes), options, true) };
}

function pcmOf(audio: DecodedAudio, options: ConvertOptions, bigEndian: boolean): Uint8Array {
  if (audio.left.length === 0) throw new ConversionError('empty');
  const gain = options.replayGain
    ? replayGainFactor(options.trackGainDb, peakOf(audio.left, audio.right))
    : 1;
  return interleave16(audio.left, audio.right, { gain, bigEndian });
}

function failureOf(error: unknown): ConversionFailure {
  if (error instanceof NotDecodableError) return 'not-decodable';
  if (error instanceof OnlineEncoderUnavailableError) return 'online-encoder-unavailable';
  return 'encoder-failed';
}
