import { SAMPLE_RATE } from './pcm';

/** Stereo float audio at 44.1 kHz. */
export interface DecodedAudio {
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly durationSeconds: number;
}

/** The platform could not decode the file (an unsupported format or a damaged file). */
export class NotDecodableError extends Error {
  constructor(options?: ErrorOptions) {
    super('This file could not be decoded', options);
    this.name = 'NotDecodableError';
  }
}

/** The part of `OfflineAudioContext` decoding uses. */
export type AudioContextFactory = (
  channels: number,
  length: number,
  sampleRate: number,
) => Pick<
  OfflineAudioContext,
  'decodeAudioData' | 'createBufferSource' | 'destination' | 'startRendering'
>;

const browserContexts: AudioContextFactory = (channels, length, sampleRate) =>
  new OfflineAudioContext(channels, length, sampleRate);

const STEREO = 2;

/**
 * Decodes a file's bytes with the platform's own decoder (Web Audio) to 44.1 kHz stereo. Mono and
 * multichannel audio is mixed to stereo with the Web Audio rules.
 */
export async function decodeAudio(
  file: ArrayBuffer,
  contexts: AudioContextFactory = browserContexts,
): Promise<DecodedAudio> {
  // decodeAudioData resamples to the context's rate. It takes over (detaches) the buffer.
  const decoder = contexts(STEREO, 1, SAMPLE_RATE);
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(file);
  } catch (error) {
    throw new NotDecodableError({ cause: error });
  }
  const stereo =
    decoded.numberOfChannels === STEREO ? decoded : await mixToStereo(decoded, contexts);
  return {
    left: stereo.getChannelData(0),
    right: stereo.getChannelData(1),
    durationSeconds: decoded.duration,
  };
}

async function mixToStereo(buffer: AudioBuffer, contexts: AudioContextFactory) {
  const context = contexts(STEREO, buffer.length, SAMPLE_RATE);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return context.startRendering();
}
