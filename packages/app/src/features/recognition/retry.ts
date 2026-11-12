import { isJsonObject as isRecord, jsonText as text } from '@mdconnect/core';

/** A recognition service could not be reached, refused the request or limited it, twice. */
export class ServiceUnreachableError extends Error {
  constructor(options?: ErrorOptions) {
    super('The service could not be reached', options);
    this.name = 'ServiceUnreachableError';
  }
}

/** The pause before the one retry, long enough for a rate limit of one request a second. */
export const RETRY_PAUSE_MS = 2000;

export interface RetryOptions {
  readonly sleep: (ms: number) => Promise<void>;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Runs `attempt`, and once more after a pause when it fails. A second failure becomes a
 * `ServiceUnreachableError`; a cancel is passed on as it is and never retried.
 */
export async function withRetry<T>(attempt: () => Promise<T>, options: RetryOptions): Promise<T> {
  const cancelled = () => options.signal?.aborted === true;
  try {
    return await attempt();
  } catch (error) {
    if (cancelled()) throw error;
  }
  await options.sleep(RETRY_PAUSE_MS);
  options.signal?.throwIfAborted();
  try {
    return await attempt();
  } catch (error) {
    if (cancelled()) throw error;
    throw new ServiceUnreachableError({ cause: error });
  }
}

export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

/** Fetches JSON, treating any status other than 2xx as a failure. */
export async function fetchJson(
  fetch: FetchFunction,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`The service answered ${String(response.status)}`);
  return (await response.json()) as unknown;
}

/** An artist credit as one line: each name followed by its join phrase. */
export function artistCredit(credits: readonly unknown[]): string {
  return credits
    .map((credit) =>
      isRecord(credit) ? `${text(credit.name) ?? ''}${text(credit.joinphrase) ?? ''}` : '',
    )
    .join('');
}
