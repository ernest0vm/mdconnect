import { describe, expect, it } from 'vitest';

import { ConversionError, convertTrack, type ConvertDependencies } from './convert-track';
import { NotDecodableError } from './decode';
import { OnlineEncoderUnavailableError } from './encoders';
import { atracWav, omaFile } from './testing/audio-fixtures';

const file = (data: Uint8Array<ArrayBuffer>, name = 'song.mp3') => new File([data], name);

/** Decodes to two samples per channel at full scale, and records what each step was given. */
function deps(overrides: Partial<ConvertDependencies> = {}) {
  const calls: string[] = [];
  const base: ConvertDependencies = {
    decode: () => {
      calls.push('decode');
      return Promise.resolve({
        left: new Float32Array([0.5, 0.5]),
        right: new Float32Array([-0.5, -0.5]),
        durationSeconds: 2 / 44_100,
      });
    },
    builtIn: (wav, mode) => {
      calls.push(`built-in ${mode} ${String(wav.length)}`);
      return Promise.resolve(new Uint8Array([7]));
    },
    online: (_file, name, mode, options) => {
      calls.push(`online ${name} ${mode} ${String(options.replayGain)}`);
      return Promise.resolve({ mode, data: new Uint8Array([8]) });
    },
  };
  return { deps: { ...base, ...overrides }, calls };
}

const options = { encoder: 'built-in' as const, replayGain: false, trackGainDb: undefined };

describe('convertTrack', () => {
  it('sends SP as big-endian PCM (audio-conversion: "SP audio")', async () => {
    const { deps: d } = deps();
    const track = await convertTrack(file(new Uint8Array(16)), 'sp', options, d);
    expect(track.mode).toBe('sp');
    expect([...track.data]).toEqual([0x40, 0x00, 0xc0, 0x00, 0x40, 0x00, 0xc0, 0x00]);
  });

  it('keeps SP mono as its own mode (audio-conversion: "SP mono")', async () => {
    const { deps: d } = deps();
    expect((await convertTrack(file(new Uint8Array(16)), 'spMono', options, d)).mode).toBe(
      'spMono',
    );
  });

  it('applies ReplayGain to SP when it is on', async () => {
    const { deps: d } = deps();
    const track = await convertTrack(
      file(new Uint8Array(16)),
      'sp',
      { ...options, replayGain: true, trackGainDb: -6 },
      d,
    );
    expect(new DataView(track.data.buffer).getInt16(0)).toBe(
      Math.round(0.5 * 10 ** (-6 / 20) * 32767),
    );
  });

  it('encodes LP2 with the built-in encoder from a WAV', async () => {
    const { deps: d, calls } = deps();
    const track = await convertTrack(file(new Uint8Array(16)), 'lp2', options, d);
    expect(track).toEqual({ mode: 'lp2', data: new Uint8Array([7]) });
    // A 44-byte header and two stereo 16-bit samples.
    expect(calls).toEqual(['decode', 'built-in lp2 52']);
  });

  it('passes the abort signal to the encoder', async () => {
    const controller = new AbortController();
    const signals: (AbortSignal | undefined)[] = [];
    const { deps: d } = deps({
      builtIn: (_wav, _mode, signal) => {
        signals.push(signal);
        return Promise.resolve(new Uint8Array([7]));
      },
    });
    await convertTrack(
      file(new Uint8Array(16)),
      'lp4',
      { ...options, signal: controller.signal },
      d,
    );
    expect(signals).toEqual([controller.signal]);
  });

  it('uses the mode the online encoder sent back', async () => {
    const { deps: d } = deps({
      online: () => Promise.resolve({ mode: 'lp105', data: new Uint8Array([9]) }),
    });
    const track = await convertTrack(
      file(new Uint8Array(16)),
      'lp2',
      { ...options, encoder: 'online' },
      d,
    );
    expect(track.mode).toBe('lp105');
  });

  it('reports a file that can no longer be read', async () => {
    const { deps: d } = deps();
    const gone = new File([new Uint8Array(16)], 'gone.mp3');
    gone.slice = () => {
      throw new DOMException('The file was removed', 'NotFoundError');
    };
    await expect(convertTrack(gone, 'sp', options, d)).rejects.toMatchObject({
      reason: 'unreadable',
    });
  });

  it('sends the original file to the online encoder without decoding it', async () => {
    const { deps: d, calls } = deps();
    const track = await convertTrack(
      file(new Uint8Array(16), 'a.flac'),
      'lp4',
      { ...options, encoder: 'online', replayGain: true },
      d,
    );
    expect(track).toEqual({ mode: 'lp4', data: new Uint8Array([8]) });
    expect(calls).toEqual(['online a.flac lp4 true']);
  });

  it('uploads an ATRAC3 file as is, in its own mode, whatever mode is chosen (audio-conversion: "LP4 ATRAC3 WAV")', async () => {
    const { deps: d, calls } = deps();
    const track = await convertTrack(file(atracWav(96, 192), 'a.wav'), 'sp', options, d);
    expect(track.mode).toBe('lp4');
    expect(track.data).toHaveLength(192);
    expect(calls).toEqual([]);
  });

  it('refuses an encrypted OMA (audio-conversion: "Encrypted OMA")', async () => {
    const { deps: d } = deps();
    const attempt = convertTrack(
      file(omaFile({ frameSize: 384, jointStereo: false, encrypted: true }), 'a.oma'),
      'sp',
      options,
      d,
    );
    await expect(attempt).rejects.toMatchObject({ reason: 'not-supported' });
  });

  it('reports a file that cannot be decoded (track-upload: "A file cannot be decoded")', async () => {
    const { deps: d } = deps({ decode: () => Promise.reject(new NotDecodableError()) });
    const attempt = convertTrack(file(new Uint8Array(16)), 'sp', options, d);
    await expect(attempt).rejects.toBeInstanceOf(ConversionError);
    await expect(attempt).rejects.toMatchObject({ reason: 'not-decodable' });
  });

  it('reports an unavailable online encoder (audio-conversion: "Service unavailable")', async () => {
    const { deps: d } = deps({ online: () => Promise.reject(new OnlineEncoderUnavailableError()) });
    await expect(
      convertTrack(file(new Uint8Array(16)), 'lp2', { ...options, encoder: 'online' }, d),
    ).rejects.toMatchObject({ reason: 'online-encoder-unavailable' });
  });

  it('reports silence of zero length as empty', async () => {
    const { deps: d } = deps({
      decode: () =>
        Promise.resolve({
          left: new Float32Array(),
          right: new Float32Array(),
          durationSeconds: 0,
        }),
    });
    await expect(convertTrack(file(new Uint8Array(16)), 'sp', options, d)).rejects.toMatchObject({
      reason: 'empty',
    });
  });
});
