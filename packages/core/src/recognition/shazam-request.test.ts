import { describe, expect, it } from 'vitest';

import { readShazamResponse, shazamRequest } from './shazam-request';

const signature = { uri: 'data:audio/vnd.shazam.sig;base64,AAAA', sampleMs: 12_000 };

describe('shazamRequest (song-recognition: "Shazam request")', () => {
  const request = shazamRequest(
    signature,
    () => 'f0f0f0f0-0000-4000-8000-000000000000',
    1_700_000_000_000,
  );

  it('posts to Shazam’s recognition endpoint', () => {
    const url = new URL(request.url);
    expect(url.origin).toBe('https://amp.shazam.com');
    expect(url.pathname).toBe(
      '/discovery/v5/en/US/android/-/tag/F0F0F0F0-0000-4000-8000-000000000000/F0F0F0F0-0000-4000-8000-000000000000',
    );
    expect(url.searchParams.get('sync')).toBe('true');
    expect(request.init.method).toBe('POST');
  });

  it('sends the signature and its length, and nothing about the user', () => {
    const body: unknown = JSON.parse(request.init.body);
    expect(body).toEqual({
      timezone: 'Europe/Paris',
      signature: { uri: signature.uri, samplems: 12_000 },
      timestamp: 1_700_000_000_000,
      context: {},
      geolocation: {},
    });
  });
});

/** A match, trimmed to the fields read (the shape amp.shazam.com answers with, as shazam-api reads it). */
const match = {
  matches: [{ id: '1' }],
  track: {
    title: 'Dawn',
    subtitle: 'Eleni Karaindrou',
    sections: [
      {
        type: 'SONG',
        metadata: [
          { title: 'Album', text: 'Eternity and a Day' },
          { title: 'Label', text: 'ECM' },
          { title: 'Released', text: '1998' },
        ],
      },
      { type: 'LYRICS' },
    ],
  },
};

describe('readShazamResponse', () => {
  it('reads the title, artist, album and year of a match', () => {
    expect(readShazamResponse(match)).toEqual({
      title: 'Dawn',
      artist: 'Eleni Karaindrou',
      album: 'Eternity and a Day',
      year: '1998',
    });
  });

  it('gives null when there is no match', () => {
    expect(readShazamResponse({ matches: [], tagid: 'x' })).toBeNull();
  });

  it('leaves out an album and year the response does not have', () => {
    const bare = {
      matches: [{}],
      track: { title: 'Dawn', subtitle: 'Eleni Karaindrou', sections: [] },
    };
    expect(readShazamResponse(bare)).toEqual({
      title: 'Dawn',
      artist: 'Eleni Karaindrou',
      album: null,
      year: null,
    });
  });

  it('refuses a response it does not understand', () => {
    expect(() => readShazamResponse('nope')).toThrow(/Shazam/u);
    expect(() => readShazamResponse({ matches: [{}], track: { subtitle: 'x' } })).toThrow(
      /Shazam/u,
    );
  });
});
