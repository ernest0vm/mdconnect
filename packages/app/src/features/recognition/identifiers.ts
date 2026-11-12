import {
  SHAZAM_SAMPLE_RATE,
  shazamSignature,
  type ShazamSignature,
  type Song,
} from '@mdconnect/core';

import type { PcmBuffer } from '../recording/wav';
import { lookupAcoustId } from './acoustid';
import type { Fingerprinter } from './fingerprint';
import { acoustIdPlan, shazamPlan, type Identifier } from './identify-session';
import { type FetchFunction, withRetry } from './retry';

/** Turns an excerpt into the 16 kHz mono 16-bit samples a Shazam signature is made from. */
export type Resampler = (pcm: PcmBuffer, sampleRate: number) => Promise<Int16Array>;

/** The part of an `OfflineAudioContext` the resampler uses. */
export interface OfflineContextLike {
  readonly destination: AudioNode;
  createBuffer(
    channels: number,
    frames: number,
    sampleRate: number,
  ): { getChannelData(channel: number): Float32Array };
  createBufferSource(): {
    buffer: unknown;
    connect(destination: AudioNode): unknown;
    start(): void;
  };
  startRendering(): Promise<{ getChannelData(channel: number): Float32Array }>;
}

const defaultContext = (channels: number, length: number, rate: number): OfflineContextLike =>
  new OfflineAudioContext(channels, length, rate);

/**
 * Resamples with an `OfflineAudioContext`, the browser's own resampler: the excerpt is played
 * into a one-channel 16 kHz context, which mixes the channels down.
 */
export function offlineResampler(
  createContext: (
    channels: number,
    length: number,
    rate: number,
  ) => OfflineContextLike = defaultContext,
): Resampler {
  return async (pcm, sampleRate) => {
    const frames = pcm.frames;
    const length = Math.ceil((frames * SHAZAM_SAMPLE_RATE) / sampleRate);
    const context = createContext(1, length, SHAZAM_SAMPLE_RATE);
    const buffer = context.createBuffer(pcm.channels, frames, sampleRate);
    const samples = pcm.samples();
    for (let channel = 0; channel < pcm.channels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let frame = 0; frame < frames; frame++) {
        data[frame] = (samples[frame * pcm.channels + channel] ?? 0) / 32_768;
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    const rendered = (await context.startRendering()).getChannelData(0);
    return Int16Array.from(rendered, (value) =>
      Math.max(-32_768, Math.min(32_767, Math.round(value * 32_768))),
    );
  };
}

/** Asks Shazam, through the desktop app's main process, about the signature of an excerpt. */
export type ShazamAsk = (signature: ShazamSignature) => Promise<Song | null>;

export function shazamIdentifier(
  ask: ShazamAsk,
  resample: Resampler,
  sleep: (ms: number) => Promise<void>,
): Identifier {
  return {
    plan: shazamPlan,
    async identify(pcm, sampleRate, _trackSeconds, signal) {
      const signature = shazamSignature(await resample(pcm, sampleRate));
      return withRetry(() => ask(signature), { sleep, signal });
    },
  };
}

export function acoustIdIdentifier(
  fingerprint: Fingerprinter,
  fetch: FetchFunction,
  sleep: (ms: number) => Promise<void>,
): Identifier {
  return {
    plan: acoustIdPlan,
    async identify(pcm, sampleRate, trackSeconds, signal) {
      const code = await fingerprint(pcm.chunkList(), sampleRate, pcm.channels);
      return lookupAcoustId(code, trackSeconds, { fetch, sleep, signal });
    },
  };
}
