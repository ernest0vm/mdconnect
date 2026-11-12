import { describe, expect, it } from 'vitest';

import { blockPeak, openInput, recordFrames, type BlockSource } from './capture';

/** A block source the test feeds by hand. */
function fakeSource(channels = 2, sampleRate = 44_100) {
  const listeners = new Set<(block: Float32Array[]) => void>();
  const source: BlockSource = {
    channels,
    sampleRate,
    onBlock(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const feed = (frames: number, value = 0.1) => {
    const block = Array.from({ length: channels }, () => new Float32Array(frames).fill(value));
    for (const listener of [...listeners]) listener(block);
  };
  return { source, feed, listeners };
}

describe('openInput', () => {
  const constraintsOf = (calls: MediaStreamConstraints[]) =>
    calls.map((call) => call.audio as MediaTrackConstraints);

  it('asks for the chosen input in stereo at 44.1 kHz with no processing (deck-recording: "One track")', async () => {
    const calls: MediaStreamConstraints[] = [];
    const stream = {} as MediaStream;
    await openInput(
      {
        getUserMedia: (constraints) => {
          calls.push(constraints);
          return Promise.resolve(stream);
        },
      },
      'line-in',
    );
    expect(constraintsOf(calls)).toEqual([
      {
        deviceId: { exact: 'line-in' },
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 44_100 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    ]);
  });

  it('retries without a sample rate when the input refuses it', async () => {
    const calls: MediaStreamConstraints[] = [];
    await openInput(
      {
        getUserMedia: (constraints) => {
          calls.push(constraints);
          return calls.length === 1
            ? Promise.reject(
                Object.assign(new Error('rate'), {
                  name: 'OverconstrainedError',
                  constraint: 'sampleRate',
                }),
              )
            : Promise.resolve({} as MediaStream);
        },
      },
      'line-in',
    );
    expect(constraintsOf(calls).map((audio) => audio.sampleRate)).toEqual([
      { ideal: 44_100 },
      undefined,
    ]);
  });

  it('passes on other failures, such as a refused permission', async () => {
    const refused = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    await expect(
      openInput({ getUserMedia: () => Promise.reject(refused) }, 'line-in'),
    ).rejects.toBe(refused);
  });
});

describe('recordFrames', () => {
  it('collects blocks until the requested number of frames, then stops listening', async () => {
    const { source, feed, listeners } = fakeSource();
    const recording = recordFrames(source, 300, new AbortController().signal);
    feed(128);
    feed(128);
    feed(128);
    feed(128);
    const pcm = await recording;
    expect(pcm.frames).toBe(384);
    expect(listeners.size).toBe(0);
  });

  it('reports progress as the share of frames received', async () => {
    const { source, feed } = fakeSource();
    const progress: number[] = [];
    const recording = recordFrames(source, 256, new AbortController().signal, (share) =>
      progress.push(share),
    );
    feed(128);
    feed(128);
    await recording;
    expect(progress).toEqual([0.5, 1]);
  });

  it('rejects with an AbortError and stops listening when cancelled (deck-recording: "Cancel")', async () => {
    const { source, feed, listeners } = fakeSource();
    const controller = new AbortController();
    const recording = recordFrames(source, 1000, controller.signal);
    feed(128);
    controller.abort();
    await expect(recording).rejects.toMatchObject({ name: 'AbortError' });
    expect(listeners.size).toBe(0);
  });
});

describe('blockPeak', () => {
  it('is the loudest sample of any channel', () => {
    expect(blockPeak([new Float32Array([0.1, -0.7]), new Float32Array([0.3])])).toBeCloseTo(0.7);
    expect(blockPeak([])).toBe(0);
  });
});
