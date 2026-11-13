import { randomUUID } from 'node:crypto';

import {
  ACOUSTID_ORIGIN,
  checkShazamSignature,
  MUSICBRAINZ_ORIGIN,
  readShazamResponse,
  recognitionUserAgent,
  shazamRequest,
  type Song,
} from '@mdconnect/core';
import { ipcMain, net, type Session } from 'electron';

import { IPC } from '../shared/ipc';
import { isAppOrigin, type OriginContext } from './url-policy';

/** A request Shazam has not answered by then is given up, so a cancel is never held back. */
const SHAZAM_TIMEOUT_MS = 15_000;

export interface ShazamDependencies {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly newId: () => string;
  readonly now: () => number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Asks Shazam about a signature on the page's behalf: only for the app's own origin, only a
 * well-formed signature of at most 15 seconds, and only to Shazam's recognition endpoint. Returns
 * the song found, or null.
 */
export async function shazamCall(
  senderOrigin: string,
  request: unknown,
  origins: OriginContext,
  dependencies: ShazamDependencies,
): Promise<Song | null> {
  if (!isAppOrigin(senderOrigin, origins)) throw new Error('Not allowed');
  if (!isRecord(request) || !checkShazamSignature(request.uri, request.sampleMs)) {
    throw new Error('Bad recognition call');
  }
  const { uri, sampleMs } = request as { uri: string; sampleMs: number };
  const { url, init } = shazamRequest({ uri, sampleMs }, dependencies.newId, dependencies.now());
  const response = await dependencies.fetch(url, {
    ...init,
    signal: AbortSignal.timeout(SHAZAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Shazam answered ${String(response.status)}`);
  return readShazamResponse(await response.json());
}

const IDENTIFIED_ORIGINS = [MUSICBRAINZ_ORIGIN, ACOUSTID_ORIGIN];

/**
 * The request headers with mdconnect's User-Agent for MusicBrainz and AcoustID, which ask clients
 * to name themselves; any other request keeps its headers.
 */
export function headersWithUserAgent(
  url: string,
  headers: Record<string, string>,
  userAgent: string,
): Record<string, string> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return headers;
  }
  if (!IDENTIFIED_ORIGINS.includes(origin)) return headers;
  const others = Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'user-agent'),
  );
  return { ...others, 'User-Agent': userAgent };
}

/**
 * Answers the page's Shazam calls, and names mdconnect in the User-Agent of its requests to
 * MusicBrainz and AcoustID.
 */
export function installRecognitionHandlers(
  session: Session,
  origins: OriginContext,
  version: string,
): void {
  const dependencies: ShazamDependencies = {
    fetch: (url, init) => net.fetch(url, init),
    newId: randomUUID,
    now: Date.now,
  };
  ipcMain.handle(IPC.recognitionShazam, (event, request: unknown) =>
    shazamCall(event.senderFrame?.origin ?? '', request, origins, dependencies),
  );
  const userAgent = recognitionUserAgent(version);
  session.webRequest.onBeforeSendHeaders(
    { urls: IDENTIFIED_ORIGINS.map((origin) => `${origin}/*`) },
    (details, callback) => {
      callback({
        requestHeaders: headersWithUserAgent(details.url, details.requestHeaders, userAgent),
      });
    },
  );
}
