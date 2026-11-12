import { PcmBuffer } from './wav';

/** The part of `navigator.mediaDevices` that opening an input uses. */
export interface MediaDevicesLike {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
}

const isRefusedSampleRate = (error: unknown) =>
  error instanceof Error &&
  error.name === 'OverconstrainedError' &&
  (error as Error & { readonly constraint?: string }).constraint === 'sampleRate';

/**
 * Opens the chosen input for recording: stereo at 44.1 kHz where it offers them, with echo
 * cancellation, noise suppression and automatic gain off. An input that refuses the rate is
 * opened again at its own rate.
 */
export async function openInput(media: MediaDevicesLike, deviceId: string): Promise<MediaStream> {
  const audio: MediaTrackConstraints = {
    deviceId: { exact: deviceId },
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 44_100 },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };
  let stream: MediaStream;
  try {
    stream = await media.getUserMedia({ audio });
  } catch (error) {
    if (!isRefusedSampleRate(error)) throw error;
    const { sampleRate: _refused, ...withoutRate } = audio;
    stream = await media.getUserMedia({ audio: withoutRate });
  }
  const settings = stream.getAudioTracks()[0]?.getSettings() ?? {};
  // Only an input that reports each kind of processing as off is known to leave the music alone.
  if (
    settings.echoCancellation !== false ||
    settings.noiseSuppression !== false ||
    settings.autoGainControl !== false
  ) {
    for (const track of stream.getTracks()) track.stop();
    throw new InputProcessingError();
  }
  return stream;
}

/** The input kept echo cancellation, noise suppression or automatic gain on, which would change the music. */
export class InputProcessingError extends Error {
  override readonly name = 'InputProcessingError';
  constructor() {
    super('The input cannot turn off its sound processing');
  }
}

/** The input stopped delivering audio, such as an unplugged USB audio interface. */
export class InputLostError extends Error {
  override readonly name = 'InputLostError';
  constructor() {
    super('The audio input stopped');
  }
}

/** Blocks of captured audio, one float array per channel. */
export interface BlockSource {
  readonly channels: number;
  readonly sampleRate: number;
  onBlock(listener: (block: Float32Array[]) => void): () => void;
  /** Calls the listener when the input stops for good; returns a function that stops listening. */
  onEnded(listener: () => void): () => void;
}

/** The loudest sample in a block, from 0 to 1 (more when the input clipped). */
export function blockPeak(block: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of block) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

/**
 * Records `frames` frames from the source. The length is counted in samples received, not with
 * timers, so a hidden window (whose timers are throttled) still records the whole track.
 */
export function recordFrames(
  source: BlockSource,
  frames: number,
  signal: AbortSignal,
  onProgress?: (share: number) => void,
): Promise<PcmBuffer> {
  return new Promise((resolve, reject) => {
    const pcm = new PcmBuffer(source.channels);
    const finish = () => {
      stopListening();
      stopWatchingEnd();
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new DOMException('The recording was cancelled', 'AbortError'));
    };
    const stopWatchingEnd = source.onEnded(() => {
      finish();
      reject(new InputLostError());
    });
    const stopListening = source.onBlock((block) => {
      pcm.append(block);
      onProgress?.(Math.min(pcm.frames / frames, 1));
      if (pcm.frames >= frames) {
        finish();
        resolve(pcm);
      }
    });
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort);
  });
}
