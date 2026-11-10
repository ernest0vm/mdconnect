import { describe, expect, it } from 'vitest';

import {
  atracdencArguments,
  BuiltInEncoder,
  encodeOnline,
  OnlineEncoderUnavailableError,
  type EncodeReply,
  type EncoderWorker,
} from './encoders';
import { atracWav } from './testing/audio-fixtures';

describe('atracdencArguments', () => {
  it('encodes LP2 at 128 kbps and LP4 with the LP4 preset, as raw frames', () => {
    expect(atracdencArguments('lp2')).toEqual([
      '-e',
      'atrac3',
      '--bitrate',
      '128',
      '--container',
      'raw',
      '-i',
      'in.wav',
      '-o',
      'out.raw',
      '--nostdout',
    ]);
    expect(atracdencArguments('lp4')).toEqual([
      '-e',
      'atrac3_lp4',
      '--container',
      'raw',
      '-i',
      'in.wav',
      '-o',
      'out.raw',
      '--nostdout',
    ]);
  });
});

describe('BuiltInEncoder', () => {
  /** A worker that answers each request with `reply`, recording what it was sent. */
  function fakeWorker(reply: (request: { wav: ArrayBuffer; mode: string }) => EncodeReply) {
    const requests: { wav: ArrayBuffer; mode: string }[] = [];
    let terminated = 0;
    const worker: EncoderWorker = {
      onmessage: null,
      onerror: null,
      postMessage(message: { wav: ArrayBuffer; mode: string }) {
        requests.push(message);
        queueMicrotask(() =>
          this.onmessage?.({ data: reply(message) } as MessageEvent<EncodeReply>),
        );
      },
      terminate: () => {
        terminated += 1;
      },
    };
    return { worker, requests, terminated: () => terminated };
  }

  it('sends a WAV to a fresh worker and returns the frames (audio-conversion: "Encode LP2 offline")', async () => {
    const { worker, requests, terminated } = fakeWorker(() => ({
      ok: true,
      data: new Uint8Array([1, 2, 3]).buffer,
    }));
    const encoder = new BuiltInEncoder(() => worker);
    const frames = await encoder.encode(new Uint8Array(52), 'lp2');
    expect([...frames]).toEqual([1, 2, 3]);
    expect(requests[0]?.mode).toBe('lp2');
    expect(requests[0]?.wav.byteLength).toBe(52);
    expect(terminated()).toBe(1);
  });

  it('stops the worker when aborted', async () => {
    const { worker, terminated } = fakeWorker(() => ({ ok: true, data: new ArrayBuffer(0) }));
    worker.postMessage = () => undefined; // never answers
    const controller = new AbortController();
    const encoding = new BuiltInEncoder(() => worker).encode(
      new Uint8Array(52),
      'lp2',
      controller.signal,
    );
    controller.abort(new Error('cancelled'));
    await expect(encoding).rejects.toThrow('cancelled');
    expect(terminated()).toBeGreaterThan(0);
  });

  it('reports an encoder failure and still ends the worker', async () => {
    const { worker, terminated } = fakeWorker(() => ({ ok: false, message: 'Fatal error' }));
    await expect(
      new BuiltInEncoder(() => worker).encode(new Uint8Array(52), 'lp4'),
    ).rejects.toThrow(/Fatal error/);
    expect(terminated()).toBe(1);
  });
});

describe('encodeOnline', () => {
  const file = new Blob([new Uint8Array([9, 9])], { type: 'audio/mpeg' });
  const encoded = atracWav(192, 384);

  function fakeFetch(responses: (Response | Error)[]) {
    const calls: { url: string; body: FormData }[] = [];
    const fetchImpl = (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body as FormData });
      const next = responses.shift() ?? new Error('no more responses');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    };
    return { fetchImpl, calls };
  }

  it('posts the original file and returns the ATRAC3 frames without the WAV header', async () => {
    const { fetchImpl, calls } = fakeFetch([new Response(encoded)]);
    const encodedTrack = await encodeOnline(
      file,
      'song.mp3',
      'lp2',
      { replayGain: false },
      fetchImpl,
    );
    expect(encodedTrack.mode).toBe('lp2');
    expect(encodedTrack.data).toHaveLength(384);
    expect(calls[0]?.url).toBe('https://atrac.minidisc.wiki/transcode?type=LP2');
    const sent = calls[0]?.body.get('file');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('song.mp3');
  });

  it('asks the service to apply ReplayGain when it is on', async () => {
    const { fetchImpl, calls } = fakeFetch([new Response(atracWav(96, 96))]);
    await encodeOnline(file, 'song.mp3', 'lp4', { replayGain: true }, fetchImpl);
    expect(calls[0]?.url).toBe(
      'https://atrac.minidisc.wiki/transcode?type=LP4&applyReplaygain=true',
    );
  });

  it('tries again after two failures', async () => {
    const { fetchImpl, calls } = fakeFetch([
      new TypeError('Failed to fetch'),
      new Response('busy', { status: 503 }),
      new Response(encoded),
    ]);
    const encodedTrack = await encodeOnline(
      file,
      'song.mp3',
      'lp2',
      { replayGain: false },
      fetchImpl,
    );
    expect(encodedTrack.data).toHaveLength(384);
    expect(calls).toHaveLength(3);
  });

  it('gives up on an attempt that stalls, then tries again', async () => {
    let calls = 0;
    const fetchImpl = (_url: string, init: RequestInit) => {
      calls += 1;
      if (calls > 1) return Promise.resolve(new Response(encoded));
      // The service accepts the connection and never answers.
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Timed out', 'TimeoutError'));
        });
      });
    };
    const encodedTrack = await encodeOnline(
      file,
      'song.mp3',
      'lp2',
      { replayGain: false, timeoutMs: 10 },
      fetchImpl,
    );
    expect(encodedTrack.data).toHaveLength(384);
    expect(calls).toBe(2);
  });

  it('stops trying once aborted', async () => {
    const controller = new AbortController();
    const { fetchImpl, calls } = fakeFetch([
      new TypeError('Failed to fetch'),
      new Response(encoded),
    ]);
    controller.abort(new Error('cancelled'));
    await expect(
      encodeOnline(
        file,
        'song.mp3',
        'lp2',
        { replayGain: false, signal: controller.signal },
        fetchImpl,
      ),
    ).rejects.toThrow('cancelled');
    expect(calls).toHaveLength(0);
  });

  it('gives up after three failures (audio-conversion: "Service unavailable")', async () => {
    const { fetchImpl, calls } = fakeFetch([
      new TypeError('Failed to fetch'),
      new TypeError('Failed to fetch'),
      new Response('not ATRAC'),
    ]);
    const attempt = encodeOnline(file, 'song.mp3', 'lp2', { replayGain: false }, fetchImpl);
    await expect(attempt).rejects.toBeInstanceOf(OnlineEncoderUnavailableError);
    await expect(attempt).rejects.toThrow('The online encoder is not available');
    expect(calls).toHaveLength(3);
  });
});
