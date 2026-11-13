/*
 * The request and the reading of its answer follow shazam-api 0.3.0, src/api.ts
 * (`Endpoint`, `Shazam.recognizeSong`), by asivery, GPL-2.0. Rewritten for mdconnect on 2026-11-12
 * as a request builder and an answer reader with no fetching of their own. Only the desktop main
 * process uses them: Shazam refuses requests from web pages.
 */

import { isJsonObject as isRecord, jsonList as list, jsonText as text } from './json';
import type { ShazamSignature } from './shazam-signature';
import type { Song } from './song';

export const SHAZAM_ORIGIN = 'https://amp.shazam.com';

/** What upstream sends; Shazam answers only clients that present themselves as its app. */
const HEADERS = {
  'X-Shazam-Platform': 'IPHONE',
  'X-Shazam-AppVersion': '14.1.0',
  Accept: '*/*',
  'Content-Type': 'application/json',
  'Accept-Language': 'en',
  'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 5.0.2; VS980 4G Build/LRX22G)',
} as const;

const PARAMS = {
  sync: 'true',
  webv3: 'true',
  sampling: 'true',
  connected: '',
  shazamapiversion: 'v3',
  sharehub: 'true',
  video: 'v3',
} as const;

export interface ShazamRequest {
  readonly url: string;
  readonly init: {
    readonly method: 'POST';
    readonly headers: Record<string, string>;
    readonly body: string;
  };
}

/**
 * The recognition request for a signature. The body carries the signature and its length, with
 * upstream's fixed time zone and empty context and location, so nothing about the user is sent.
 */
export function shazamRequest(
  signature: ShazamSignature,
  newId: () => string,
  now: number,
): ShazamRequest {
  const url = new URL(
    `${SHAZAM_ORIGIN}/discovery/v5/en/US/android/-/tag/${newId().toUpperCase()}/${newId().toUpperCase()}`,
  );
  for (const [name, value] of Object.entries(PARAMS)) url.searchParams.append(name, value);
  const body = {
    timezone: 'Europe/Paris',
    signature: { uri: signature.uri, samplems: signature.sampleMs },
    timestamp: now,
    context: {},
    geolocation: {},
  };
  return {
    url: url.toString(),
    init: { method: 'POST', headers: { ...HEADERS }, body: JSON.stringify(body) },
  };
}

/** The song in Shazam's answer, or null when it found none. */
export function readShazamResponse(response: unknown): Song | null {
  if (!isRecord(response) || !Array.isArray(response.matches)) {
    throw new Error('Shazam sent an answer that could not be read');
  }
  if (response.matches.length === 0) return null;
  const track = response.track;
  const title = isRecord(track) ? text(track.title) : null;
  const artist = isRecord(track) ? text(track.subtitle) : null;
  if (!isRecord(track) || title === null || artist === null) {
    throw new Error('Shazam sent a match without a title or artist');
  }
  const sections = list(track.sections);
  const song = sections.find((section) => isRecord(section) && section.type === 'SONG');
  const metadata = isRecord(song) ? list(song.metadata) : [];
  const field = (name: string) => {
    const entry = metadata.find((item) => isRecord(item) && item.title === name);
    return isRecord(entry) ? text(entry.text) : null;
  };
  return { title, artist, album: field('Album'), year: field('Released') };
}
