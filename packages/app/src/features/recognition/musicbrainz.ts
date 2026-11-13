import {
  MUSICBRAINZ_ORIGIN,
  type Song,
  isJsonObject as isRecord,
  jsonList as list,
  jsonText as text,
} from '@mdconnect/core';

import { artistCredit, fetchJson, type FetchFunction, withRetry } from './retry';

/** MusicBrainz allows one request a second from each client. */
const REQUEST_SPACING_MS = 1000;
const RESULT_LIMIT = 10;

export interface SearchResult {
  /** MusicBrainz's recording id, to tell results apart. */
  readonly id: string;
  readonly song: Song;
  /** The recording's length, when MusicBrainz knows it. */
  readonly seconds: number | null;
}

export interface MusicBrainzOptions {
  readonly fetch: FetchFunction;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

/** Characters with a meaning in MusicBrainz's Lucene query syntax. */
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/gu;

export function escapeLucene(query: string): string {
  return query.replace(LUCENE_SPECIAL, (char) => `\\${char}`);
}

/** Searches MusicBrainz's recordings by name, at most one request a second. */
export class MusicBrainzClient {
  private lastRequest: number | null = null;

  constructor(private readonly options: MusicBrainzOptions) {}

  /** Up to 10 recordings matching the text, which is the only thing sent. */
  async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const url = new URL('/ws/2/recording', MUSICBRAINZ_ORIGIN);
    url.searchParams.set('query', escapeLucene(query));
    url.searchParams.set('limit', String(RESULT_LIMIT));
    url.searchParams.set('fmt', 'json');
    const answer = await withRetry(
      async () => {
        await this.waitForTurn();
        return fetchJson(this.options.fetch, url.href, { signal: signal ?? null });
      },
      { sleep: this.options.sleep, signal },
    );
    return list(isRecord(answer) ? answer.recordings : undefined).flatMap(readRecording);
  }

  /** Reserves the next free slot before waiting for it, so searches started together queue up. */
  private async waitForTurn(): Promise<void> {
    const now = this.options.now();
    const slot =
      this.lastRequest === null ? now : Math.max(now, this.lastRequest + REQUEST_SPACING_MS);
    this.lastRequest = slot;
    if (slot > now) await this.options.sleep(slot - now);
  }
}

function readRecording(recording: unknown): SearchResult[] {
  if (!isRecord(recording)) return [];
  const id = text(recording.id);
  const title = text(recording.title);
  if (id === null || title === null) return [];
  const release = list(recording.releases).find(isRecord);
  const year = text(recording['first-release-date'])?.slice(0, 4) ?? null;
  const length = recording.length;
  return [
    {
      id,
      song: {
        title,
        artist: artistCredit(list(recording['artist-credit'])),
        album: release === undefined ? null : text(release.title),
        year: year === '' ? null : year,
      },
      seconds: typeof length === 'number' ? Math.round(length / 1000) : null,
    },
  ];
}
