import { shazamSignature } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

import { headersWithUserAgent, shazamCall } from './recognition';

const origins = { packaged: true, devServerUrl: undefined } as const;
const APP = 'app://mdconnect';

/** Two seconds of a tone, enough for a well-formed signature. */
function signature() {
  const samples = Int16Array.from({ length: 32_000 }, (_, i) =>
    Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 16_000)),
  );
  return shazamSignature(samples);
}

const match = {
  matches: [{ id: '1' }],
  track: {
    title: 'Dawn',
    subtitle: 'Eleni Karaindrou',
    sections: [{ type: 'SONG', metadata: [{ title: 'Album', text: 'Eternity and a Day' }] }],
  },
};

function fakeFetch(body: unknown) {
  const sent: { url: string; init: RequestInit }[] = [];
  return {
    sent,
    fetch: (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify(body)));
    },
  };
}

const dependencies = (fetch: ReturnType<typeof fakeFetch>['fetch']) => ({
  fetch,
  newId: () => '00000000-0000-4000-8000-000000000000',
  now: () => 0,
});

describe('shazamCall', () => {
  it('sends a well-formed signature to Shazam and returns the song (desktop-shell: "Recognised excerpt")', async () => {
    const { fetch, sent } = fakeFetch(match);
    const song = await shazamCall(APP, signature(), origins, dependencies(fetch));
    expect(song).toEqual({
      title: 'Dawn',
      artist: 'Eleni Karaindrou',
      album: 'Eternity and a Day',
      year: null,
    });
    expect(new URL(sent[0]?.url ?? '').origin).toBe('https://amp.shazam.com');
    expect(sent[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('refuses a malformed request and sends nothing (desktop-shell: "Malformed request")', async () => {
    const { fetch, sent } = fakeFetch(match);
    const { uri } = signature();
    for (const request of [
      { uri: 'https://example.com/', sampleMs: 2000 },
      { uri, sampleMs: 16_000 },
      { uri },
      'text',
      null,
    ]) {
      await expect(shazamCall(APP, request, origins, dependencies(fetch))).rejects.toThrow(
        'Bad recognition call',
      );
    }
    expect(sent).toHaveLength(0);
  });

  it('refuses another origin (desktop-shell: "Other origin")', async () => {
    const { fetch, sent } = fakeFetch(match);
    await expect(
      shazamCall('https://evil.example', signature(), origins, dependencies(fetch)),
    ).rejects.toThrow('Not allowed');
    expect(sent).toHaveLength(0);
  });

  it('fails when Shazam answers with an error status', async () => {
    const fetch = () => Promise.resolve(new Response('', { status: 429 }));
    await expect(shazamCall(APP, signature(), origins, dependencies(fetch))).rejects.toThrow(
      /429/u,
    );
  });
});

describe('headersWithUserAgent', () => {
  it('names mdconnect to MusicBrainz and AcoustID', () => {
    const ua = 'mdconnect/0.2.0 ( https://github.com/ernest0vm/mdconnect )';
    expect(
      headersWithUserAgent('https://musicbrainz.org/ws/2/recording?query=x', { Accept: 'a' }, ua),
    ).toEqual({ Accept: 'a', 'User-Agent': ua });
    expect(
      headersWithUserAgent('https://api.acoustid.org/v2/lookup', { 'User-Agent': 'Chrome' }, ua),
    ).toEqual({ 'User-Agent': ua });
  });

  it('leaves other requests as they are', () => {
    const headers = { 'User-Agent': 'Chrome' };
    expect(headersWithUserAgent('https://atrac.minidisc.wiki/transcode', headers, 'x')).toBe(
      headers,
    );
    expect(headersWithUserAgent('https://musicbrainz.org.evil.example/', headers, 'x')).toBe(
      headers,
    );
  });
});
