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
  try {
    return await media.getUserMedia({ audio });
  } catch (error) {
    if (!isRefusedSampleRate(error)) throw error;
    const { sampleRate: _refused, ...withoutRate } = audio;
    return media.getUserMedia({ audio: withoutRate });
  }
}

/** Blocks of captured audio, one float array per channel. */
export interface BlockSource {
  readonly channels: number;
  readonly sampleRate: number;
  onBlock(listener: (block: Float32Array[]) => void): () => void;
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
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new DOMException('The recording was cancelled', 'AbortError'));
    };
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
