import { ACOUSTID_CLIENT_KEY } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

import { lookupAcoustId } from './acoustid';

/** An AcoustID lookup answer with `meta=recordings releasegroups compress`, trimmed. */
const answer = {
  status: 'ok',
  results: [
    {
      id: 'a1',
      score: 0.62,
      recordings: [
        {
          id: 'r-weak',
          title: 'Dawn (live)',
          artists: [{ id: 'x', name: 'Someone' }],
        },
      ],
    },
    {
      id: 'a2',
      score: 0.91,
      recordings: [
        {
          id: 'r1',
          title: 'Dawn',
          artists: [
            { id: 'p', name: 'Eleni Karaindrou', joinphrase: ' & ' },
            { id: 'q', name: 'Jan Garbarek' },
          ],
          releasegroups: [
            { id: 'g1', type: 'Single', title: 'Dawn (single)' },
            { id: 'g2', type: 'Album', title: 'Eternity and a Day' },
          ],
        },
      ],
    },
  ],
};

function fakeFetch(body: unknown, status = 200) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { fetch, requests };
}

const options = (fetch: ReturnType<typeof fakeFetch>['fetch']) => ({
  fetch,
  sleep: () => Promise.resolve(),
});

describe('lookupAcoustId', () => {
  it('takes the best match scored 0.5 or more (song-recognition: "Match")', async () => {
    const { fetch } = fakeFetch(answer);
    expect(await lookupAcoustId('FP', 221, options(fetch))).toEqual({
      title: 'Dawn',
      artist: 'Eleni Karaindrou & Jan Garbarek',
      album: 'Eternity and a Day',
      year: null,
    });
  });

  it('gives null for no result or only weak ones (song-recognition: "Weak or no match")', async () => {
    expect(
      await lookupAcoustId('FP', 221, options(fakeFetch({ status: 'ok', results: [] }).fetch)),
    ).toBeNull();
    const weak = {
      status: 'ok',
      results: [{ id: 'a', score: 0.49, recordings: [{ id: 'r', title: 'X', artists: [] }] }],
    };
    expect(await lookupAcoustId('FP', 221, options(fakeFetch(weak).fetch))).toBeNull();
  });

  it('skips a result without recordings', async () => {
    const bare = { status: 'ok', results: [{ id: 'a', score: 0.95 }] };
    expect(await lookupAcoustId('FP', 221, options(fakeFetch(bare).fetch))).toBeNull();
  });

  it('falls back to the first release group when none is an album', async () => {
    const recording = {
      id: 'r1',
      title: 'Dawn',
      artists: [{ id: 'p', name: 'Eleni Karaindrou' }],
      releasegroups: [{ id: 'g1', type: 'Single', title: 'Dawn (single)' }],
    };
    const single = { status: 'ok', results: [{ id: 'a', score: 0.9, recordings: [recording] }] };
    expect((await lookupAcoustId('FP', 221, options(fakeFetch(single).fetch)))?.album).toBe(
      'Dawn (single)',
    );
  });

  it('sends only the key, the length, the fingerprint and meta (song-recognition: "What recognition sends")', async () => {
    const { fetch, requests } = fakeFetch(answer);
    await lookupAcoustId('AQADtNQYhYkYnGhw', 221.6, options(fetch));
    const [request] = requests;
    expect(request?.url).toBe('https://api.acoustid.org/v2/lookup');
    expect(request?.init.method).toBe('POST');
    const sent = request?.init.body;
    const body = new URLSearchParams(typeof sent === 'string' ? sent : '');
    expect(Object.fromEntries(body)).toEqual({
      client: ACOUSTID_CLIENT_KEY,
      duration: '222',
      fingerprint: 'AQADtNQYhYkYnGhw',
      meta: 'recordings releasegroups compress',
    });
  });

  it('treats an error answer as unreachable after one retry', async () => {
    const { fetch, requests } = fakeFetch(
      { status: 'error', error: { code: 4, message: 'invalid API key' } },
      400,
    );
    await expect(lookupAcoustId('FP', 221, options(fetch))).rejects.toMatchObject({
      name: 'ServiceUnreachableError',
    });
    expect(requests).toHaveLength(2);
  });
});
