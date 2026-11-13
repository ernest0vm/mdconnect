import {
  ACOUSTID_CLIENT_KEY,
  ACOUSTID_ORIGIN,
  type Song,
  isJsonObject as isRecord,
  jsonList as list,
  jsonText as text,
} from '@mdconnect/core';

import { artistCredit, fetchJson, type FetchFunction, withRetry } from './retry';

/** Below this score AcoustID's match is too weak to name a track. */
export const MIN_ACOUSTID_SCORE = 0.5;

export interface AcoustIdOptions {
  readonly fetch: FetchFunction;
  readonly sleep: (ms: number) => Promise<void>;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Looks a Chromaprint fingerprint up on AcoustID with the track's length, and gives the song of
 * the best result scored at least 0.5, or null. Only the application key, the length, the
 * fingerprint and the fields wanted are sent.
 */
export async function lookupAcoustId(
  fingerprint: string,
  trackSeconds: number,
  options: AcoustIdOptions,
): Promise<Song | null> {
  const body = new URLSearchParams({
    client: ACOUSTID_CLIENT_KEY,
    duration: String(Math.round(trackSeconds)),
    fingerprint,
    meta: 'recordings releasegroups compress',
  });
  const answer = await withRetry(async () => {
    const json = await fetchJson(options.fetch, `${ACOUSTID_ORIGIN}/v2/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: options.signal ?? null,
    });
    if (!isRecord(json) || json.status !== 'ok') throw new Error('AcoustID refused the lookup');
    return json;
  }, options);
  return bestSong(list(answer.results));
}

function bestSong(results: readonly unknown[]): Song | null {
  // Only a recording with a title can name a track, so results are ranked among those.
  const ranked = results
    .filter(isRecord)
    .map((result) => ({
      score: typeof result.score === 'number' ? result.score : 0,
      recording: list(result.recordings)
        .filter(isRecord)
        .find((recording) => text(recording.title) !== null),
    }))
    .filter((result) => result.score >= MIN_ACOUSTID_SCORE && result.recording !== undefined)
    .sort((a, b) => b.score - a.score);
  const recording = ranked[0]?.recording;
  const title = recording === undefined ? null : text(recording.title);
  if (recording === undefined || title === null) return null;
  const groups = list(recording.releasegroups).filter(isRecord);
  const album = groups.find((group) => group.type === 'Album') ?? groups[0];
  return {
    title,
    artist: artistCredit(list(recording.artists)),
    album: album === undefined ? null : text(album.title),
    year: null,
  };
}
