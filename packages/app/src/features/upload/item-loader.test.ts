import { describe, expect, it } from 'vitest';

import { NotDecodableError } from './decode';
import { loadItem, loadItemSafely, type LoaderDependencies } from './item-loader';
import { atracWav, omaFile } from './testing/audio-fixtures';

const file = (data: Uint8Array<ArrayBuffer>, name: string) => new File([data], name);

function deps(overrides: Partial<LoaderDependencies> = {}) {
  const calls: string[] = [];
  const base: LoaderDependencies = {
    readTags: () => {
      calls.push('tags');
      return Promise.resolve({ title: 'Song', durationSeconds: 61 });
    },
    measure: () => {
      calls.push('measure');
      return Promise.resolve(42);
    },
  };
  return { deps: { ...base, ...overrides }, calls };
}

describe('loadItem', () => {
  it('reads tags and the duration they give', async () => {
    const { deps: d, calls } = deps();
    expect(await loadItem(file(new Uint8Array(8), 'a.mp3'), d)).toEqual({
      tags: { title: 'Song', durationSeconds: 61 },
      durationSeconds: 61,
      atrac: null,
      problem: null,
    });
    expect(calls).toEqual(['tags']);
  });

  it('decodes a file to measure it when its tags give no duration (track-upload: "Unknown duration")', async () => {
    const { deps: d, calls } = deps({ readTags: () => Promise.resolve({}) });
    expect((await loadItem(file(new Uint8Array(8), 'a.mp3'), d)).durationSeconds).toBe(42);
    expect(calls).toEqual(['measure']);
  });

  it('marks a file that cannot be decoded, so it counts for nothing', async () => {
    const { deps: d } = deps({
      readTags: () => Promise.resolve({}),
      measure: () => Promise.reject(new NotDecodableError()),
    });
    expect(await loadItem(file(new Uint8Array(8), 'a.aiff'), d)).toMatchObject({
      durationSeconds: 0,
      problem: 'not-decodable',
    });
  });

  it('times a pre-encoded LP4 file from its frames, without decoding it', async () => {
    const { deps: d, calls } = deps();
    // 431 frames of 192 bytes are 10 seconds of LP4.
    const loaded = await loadItem(file(atracWav(96, 431 * 192), 'a.wav'), d);
    expect(loaded.atrac).toBe('lp4');
    expect(loaded.durationSeconds).toBeCloseTo(10, 1);
    expect(calls).toEqual(['tags']);
  });

  it('recognises an ATRAC3 WAV whose audio starts after 64 KiB of metadata', async () => {
    const { deps: d, calls } = deps();
    const loaded = await loadItem(file(atracWav(96, 431 * 192, 0x0270, 70 * 1024), 'a.wav'), d);
    expect(loaded.atrac).toBe('lp4');
    expect(loaded.durationSeconds).toBeCloseTo(10, 1);
    expect(calls).toEqual(['tags']);
  });

  it('marks an encrypted OMA as not supported', async () => {
    const { deps: d } = deps();
    const loaded = await loadItem(
      file(omaFile({ frameSize: 384, jointStereo: false, encrypted: true }), 'a.oma'),
      d,
    );
    expect(loaded).toMatchObject({ problem: 'not-supported', durationSeconds: 0 });
  });
});

describe('loadItemSafely', () => {
  it('marks a file whose reading fails as unreadable instead of leaving it loading', async () => {
    const failing = () => Promise.reject(new DOMException('gone', 'NotFoundError'));
    expect(await loadItemSafely(new File([], 'a.mp3'), failing)).toEqual({
      tags: {},
      durationSeconds: 0,
      atrac: null,
      problem: 'unreadable',
    });
  });
});
