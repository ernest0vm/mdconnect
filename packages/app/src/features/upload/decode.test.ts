import { describe, expect, it } from 'vitest';

import { decodeAudio, NotDecodableError, type AudioContextFactory } from './decode';

interface FakeBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly duration: number;
  getChannelData(channel: number): Float32Array;
}

const buffer = (channels: number, length: number): FakeBuffer => ({
  numberOfChannels: channels,
  length,
  duration: length / 44_100,
  getChannelData: (channel) => new Float32Array(length).fill(channel + 1),
});

/** A context whose decode returns `decoded` and whose render returns a stereo mix. */
function fakeContexts(decoded: FakeBuffer | Error) {
  const created: { channels: number; length: number; rate: number }[] = [];
  const factory: AudioContextFactory = (channels, length, rate) => {
    created.push({ channels, length, rate });
    return {
      decodeAudioData: () =>
        decoded instanceof Error
          ? Promise.reject(decoded)
          : Promise.resolve(decoded as AudioBuffer),
      createBufferSource: () =>
        ({
          buffer: null,
          connect: () => undefined,
          start: () => undefined,
        }) as unknown as AudioBufferSourceNode,
      destination: {} as AudioDestinationNode,
      startRendering: () => Promise.resolve(buffer(2, length) as AudioBuffer),
    };
  };
  return { factory, created };
}

const file = new Blob([new Uint8Array(4)]);

describe('decodeAudio', () => {
  it('decodes at 44.1 kHz and keeps a stereo file as it is', async () => {
    const { factory, created } = fakeContexts(buffer(2, 100));
    const audio = await decodeAudio(file, factory);
    expect(created).toEqual([{ channels: 2, length: 1, rate: 44_100 }]);
    expect(audio.left[0]).toBe(1);
    expect(audio.right[0]).toBe(2);
    expect(audio.durationSeconds).toBeCloseTo(100 / 44_100);
  });

  it('mixes a mono or multichannel file to stereo (audio-conversion: "Decode an MP3")', async () => {
    const { factory, created } = fakeContexts(buffer(1, 100));
    const audio = await decodeAudio(file, factory);
    expect(created[1]).toEqual({ channels: 2, length: 100, rate: 44_100 });
    expect(audio.left).toHaveLength(100);
  });

  it('reports a file the platform cannot decode (audio-conversion: "Unsupported format")', async () => {
    const { factory } = fakeContexts(
      new DOMException('Unable to decode audio data', 'EncodingError'),
    );
    await expect(decodeAudio(file, factory)).rejects.toBeInstanceOf(NotDecodableError);
  });
});
