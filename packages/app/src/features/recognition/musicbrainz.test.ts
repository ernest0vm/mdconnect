import { describe, expect, it } from 'vitest';

import { escapeLucene, MusicBrainzClient } from './musicbrainz';

/** A recording search answer from ws/2 with fmt=json, trimmed. */
const answer = {
  count: 2,
  recordings: [
    {
      id: 'r1',
      title: 'Dawn',
      length: 221_000,
      'artist-credit': [{ name: 'Eleni Karaindrou', joinphrase: '' }],
      'first-release-date': '1998-09-01',
      releases: [{ id: 'x', title: 'Eternity and a Day' }],
    },
    { id: 'r2', title: 'Dawn', 'artist-credit': [{ name: 'Other' }] },
  ],
};

function client(body: unknown, now: () => number = () => 0) {
  const urls: string[] = [];
  const pauses: number[] = [];
  const search = new MusicBrainzClient({
    fetch: (url) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(body)));
    },
    sleep: (ms) => (pauses.push(ms), Promise.resolve()),
    now,
  });
  return { search, urls, pauses };
}

describe('MusicBrainzClient', () => {
  it('lists recordings with title, artist, album, year and length (song-recognition: "Pick a result")', async () => {
    const { search } = client(answer);
    expect(await search.search('Dawn')).toEqual([
      {
        id: 'r1',
        song: {
          title: 'Dawn',
          artist: 'Eleni Karaindrou',
          album: 'Eternity and a Day',
          year: '1998',
        },
        seconds: 221,
      },
      {
        id: 'r2',
        song: { title: 'Dawn', artist: 'Other', album: null, year: null },
        seconds: null,
      },
    ]);
  });

  it('gives an empty list when nothing is found (song-recognition: "No results")', async () => {
    expect(await client({ count: 0, recordings: [] }).search.search('zzz')).toEqual([]);
  });

  it('sends only the search text, escaped, with a limit of 10 (song-recognition: "Search request")', async () => {
    const { search, urls } = client(answer);
    await search.search('Dawn');
    const url = new URL(urls[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://musicbrainz.org/ws/2/recording');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: 'Dawn',
      limit: '10',
      fmt: 'json',
    });
  });

  it('waits until a second has passed since its last request', async () => {
    let clock = 0;
    const { search, pauses } = client(answer, () => clock);
    await search.search('a');
    clock = 300;
    await search.search('b');
    expect(pauses).toEqual([700]);
  });
});

describe('escapeLucene', () => {
  it('escapes the query syntax characters', () => {
    expect(escapeLucene('AC/DC: Back (in) Black!')).toBe('AC\\/DC\\: Back \\(in\\) Black\\!');
    expect(escapeLucene('a && b || "c"')).toBe('a \\&\\& b \\|\\| \\"c\\"');
  });
});
