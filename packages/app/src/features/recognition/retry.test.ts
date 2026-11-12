import { describe, expect, it } from 'vitest';

import { ServiceUnreachableError, withRetry } from './retry';

const noPause = () => Promise.resolve();

describe('withRetry (song-recognition: "Service down")', () => {
  it('returns the first answer', async () => {
    expect(await withRetry(() => Promise.resolve(7), { sleep: noPause })).toBe(7);
  });

  it('tries once more after a pause when the first attempt fails', async () => {
    const pauses: number[] = [];
    let calls = 0;
    const result = await withRetry(
      () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve('ok');
      },
      { sleep: (ms) => (pauses.push(ms), Promise.resolve()) },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
    expect(pauses).toEqual([2000]);
  });

  it('reports the service unreachable after two failures', async () => {
    let calls = 0;
    const failing = () => {
      calls += 1;
      return Promise.reject(new Error('HTTP 503'));
    };
    await expect(withRetry(failing, { sleep: noPause })).rejects.toBeInstanceOf(
      ServiceUnreachableError,
    );
    expect(calls).toBe(2);
  });

  it('does not retry once the signal is aborted', async () => {
    const cancel = new AbortController();
    let calls = 0;
    const attempt = () => {
      calls += 1;
      cancel.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    };
    await expect(
      withRetry(attempt, { sleep: noPause, signal: cancel.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  });
});
