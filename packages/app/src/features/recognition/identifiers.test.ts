import { checkShazamSignature, type Song } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

import { PcmBuffer } from '../recording/wav';
import {
  acoustIdIdentifier,
  offlineResampler,
  shazamIdentifier,
  type OfflineContextLike,
} from './identifiers';

const dawn: Song = { title: 'Dawn', artist: 'Eleni Karaindrou', album: null, year: null };

function stereo(frames: number): PcmBuffer {
  const pcm = new PcmBuffer(2);
  pcm.append([new Float32Array(frames).fill(0.5), new Float32Array(frames).fill(-0.25)]);
  return pcm;
}

/** An OfflineAudioContext that records how it was made and renders silence of its length. */
function fakeContext() {
  const made: { channels: number; length: number; rate: number }[] = [];
  const buffers: { channels: number; frames: number; rate: number; data: Float32Array[] }[] = [];
  const create = (channels: number, length: number, rate: number): OfflineContextLike => {
    made.push({ channels, length, rate });
    return {
      destination: {} as AudioNode,
      createBuffer(bufferChannels, frames, bufferRate) {
        const data = Array.from({ length: bufferChannels }, () => new Float32Array(frames));
        buffers.push({ channels: bufferChannels, frames, rate: bufferRate, data });
        return { getChannelData: (channel: number) => data[channel] ?? new Float32Array(0) };
      },
      createBufferSource: () => ({
        buffer: null,
        connect: () => undefined,
        start: () => undefined,
      }),
      startRendering: () =>
        Promise.resolve({ getChannelData: () => new Float32Array(length).fill(0.5) }),
    };
  };
  return { create, made, buffers };
}

describe('offlineResampler', () => {
  it('renders the excerpt as 16 kHz mono of the same duration', async () => {
    const { create, made, buffers } = fakeContext();
    const samples = await offlineResampler(create)(stereo(48_000), 48_000);
    expect(made).toEqual([{ channels: 1, length: 16_000, rate: 16_000 }]);
    expect(buffers[0]).toMatchObject({ channels: 2, frames: 48_000, rate: 48_000 });
    expect(buffers[0]?.data[0]?.[0]).toBeCloseTo(0.5, 4);
    expect(buffers[0]?.data[1]?.[0]).toBeCloseTo(-0.25, 4);
    expect(samples).toHaveLength(16_000);
    expect(samples[0]).toBe(16_384);
  });
});

describe('shazamIdentifier', () => {
  it('asks Shazam with the signature of the resampled excerpt (song-recognition: "Shazam request")', async () => {
    const asked: { uri: string; sampleMs: number }[] = [];
    const identifier = shazamIdentifier(
      (signature) => (asked.push(signature), Promise.resolve(dawn)),
      () => Promise.resolve(new Int16Array(12 * 16_000)),
      () => Promise.resolve(),
    );
    const song = await identifier.identify(stereo(10), 48_000, 200, new AbortController().signal);
    expect(song).toEqual(dawn);
    expect(asked).toHaveLength(1);
    expect(checkShazamSignature(asked[0]?.uri, asked[0]?.sampleMs)).toBe(true);
  });
});

describe('acoustIdIdentifier', () => {
  it('looks up the fingerprint of the excerpt with the track length', async () => {
    const fingerprinted: { length: number; rate: number; channels: number }[] = [];
    const bodies: string[] = [];
    const identifier = acoustIdIdentifier(
      (pcm, rate, channels) => (
        fingerprinted.push({ length: pcm.length, rate, channels }),
        Promise.resolve('FP')
      ),
      (_url, init) => {
        bodies.push(typeof init.body === 'string' ? init.body : '');
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok', results: [] })));
      },
      () => Promise.resolve(),
    );
    expect(
      await identifier.identify(stereo(100), 44_100, 221, new AbortController().signal),
    ).toBeNull();
    expect(fingerprinted).toEqual([{ length: 200, rate: 44_100, channels: 2 }]);
    expect(new URLSearchParams(bodies[0]).get('duration')).toBe('221');
  });
});
