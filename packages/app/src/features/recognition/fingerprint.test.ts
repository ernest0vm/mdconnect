import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ChromaprintApi, chromaprintFingerprinter, loadChromaprint } from './fingerprint';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chromaprintFingerprinter with the real module', () => {
  it('gives Chromaprint’s own fingerprint for 130 blocks of silence', async () => {
    // Emscripten's web build checks for `window`; Vitest runs in Node.
    vi.stubGlobal('window', globalThis);
    const fingerprint = chromaprintFingerprinter(loadChromaprint);
    // Expected value from Chromaprint's tests/test_api.cpp, `TEST(API, Test2SilenceFp)`.
    expect(await fingerprint([new Int16Array(130 * 1024)], 44_100, 1)).toBe('AQAAA0mUaEkSRZEGAA');
    // Fed in parts, as the capture keeps them, the fingerprint is the same.
    expect(
      await fingerprint([new Int16Array(100 * 1024), new Int16Array(30 * 1024)], 44_100, 1),
    ).toBe('AQAAA0mUaEkSRZEGAA');
  });
});

/** A stand-in for the WebAssembly module that records every allocation. */
function fakeApi(failFeedOn: number | null = null) {
  const live = new Set<number>();
  let next = 8;
  let feeds = 0;
  const heap = new ArrayBuffer(1 << 20);
  const contexts = new Set<number>();
  const api: ChromaprintApi = {
    HEAP16: new Int16Array(heap),
    HEAP32: new Int32Array(heap),
    _malloc(size) {
      const pointer = next;
      next += Math.ceil(size / 8) * 8 + 8;
      live.add(pointer);
      return pointer;
    },
    _free(pointer) {
      live.delete(pointer);
    },
    _chromaprint_new() {
      const context = 1_000_000 + contexts.size;
      contexts.add(context);
      return context;
    },
    _chromaprint_free(context) {
      contexts.delete(context);
    },
    _chromaprint_start: () => 1,
    _chromaprint_feed() {
      feeds += 1;
      return feeds === failFeedOn ? 0 : 1;
    },
    _chromaprint_finish: () => 1,
    _chromaprint_get_fingerprint(_context, pointerToString) {
      const text = api._malloc(4);
      new Int32Array(heap)[pointerToString >> 2] = text;
      new Uint8Array(heap).set([65, 81, 0], text);
      return 1;
    },
    UTF8ToString: (pointer) => {
      const bytes = new Uint8Array(heap, pointer);
      return String.fromCharCode(...bytes.subarray(0, bytes.indexOf(0)));
    },
  };
  return { api, live, contexts };
}

describe('chromaprintFingerprinter when loading fails', () => {
  it('loads again on the next call', async () => {
    const { api } = fakeApi();
    let loads = 0;
    const fingerprint = chromaprintFingerprinter(() => {
      loads += 1;
      return loads === 1 ? Promise.reject(new Error('no wasm')) : Promise.resolve(api);
    });
    await expect(fingerprint([new Int16Array(10)], 44_100, 1)).rejects.toThrow('no wasm');
    expect(await fingerprint([new Int16Array(10)], 44_100, 1)).toBe('AQ');
    expect(loads).toBe(2);
  });
});

describe('chromaprintFingerprinter', () => {
  it('frees every allocation and context, even when one fingerprint fails, and opens no AudioContext', async () => {
    const created = vi.fn();
    vi.stubGlobal('AudioContext', created);
    const { api, live, contexts } = fakeApi(7);
    let loads = 0;
    const fingerprint = chromaprintFingerprinter(() => {
      loads += 1;
      return Promise.resolve(api);
    });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => fingerprint([new Int16Array(4410)], 44_100, 2)),
    );
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'fulfilled')).toEqual({
      status: 'fulfilled',
      value: 'AQ',
    });
    expect(live.size).toBe(0);
    expect(contexts.size).toBe(0);
    expect(created).not.toHaveBeenCalled();
    expect(loads).toBe(1);
  });
});
