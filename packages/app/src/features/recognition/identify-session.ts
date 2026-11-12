import type { Song } from '@mdconnect/core';

import type { PlaybackCommand } from '../disc/disc-reader';
import { InputLostError, recordFrames } from '../recording/capture';
import type { LiveCapture } from '../recording/capture-source';
import { prime, type RecordingDeck, type RecordingTrack } from '../recording/session';
import type { PcmBuffer } from '../recording/wav';
import { ServiceUnreachableError } from './retry';

/** What identifying one track gave. `none`: not tried, or stopped before it finished. */
export type TrackResult =
  | { readonly kind: 'found'; readonly song: Song }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'too-short' }
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'none' };

/** How much to listen to before each attempt, and how many attempts. */
export interface ExcerptPlan {
  readonly excerptSeconds: number;
  readonly attempts: number;
}

/** One way of naming a track from what was heard of it: Shazam or AcoustID. */
export interface Identifier {
  readonly plan: (trackSeconds: number) => ExcerptPlan | 'too-short';
  identify(
    pcm: PcmBuffer,
    sampleRate: number,
    trackSeconds: number,
    signal: AbortSignal,
  ): Promise<Song | null>;
}

const SHAZAM_EXCERPT_SECONDS = 12;
const SHAZAM_MAX_ATTEMPTS = 3;
const ACOUSTID_MAX_SECONDS = 120;
const ACOUSTID_MIN_SECONDS = 10;

/** Twelve-second excerpts, as many as fit whole in the track, at most three. */
export function shazamPlan(trackSeconds: number): ExcerptPlan | 'too-short' {
  const whole = Math.floor(trackSeconds / SHAZAM_EXCERPT_SECONDS);
  if (whole < 1) return 'too-short';
  return { excerptSeconds: SHAZAM_EXCERPT_SECONDS, attempts: Math.min(whole, SHAZAM_MAX_ATTEMPTS) };
}

/** Two minutes, or the whole track when it is shorter, once. */
export function acoustIdPlan(trackSeconds: number): ExcerptPlan | 'too-short' {
  if (trackSeconds < ACOUSTID_MIN_SECONDS) return 'too-short';
  return { excerptSeconds: Math.min(ACOUSTID_MAX_SECONDS, trackSeconds), attempts: 1 };
}

export interface IdentifyProgress {
  /** Zero-based place in the list. */
  readonly position: number;
  readonly total: number;
  readonly title: string;
  readonly stage: 'listening' | 'asking';
}

export type IdentifyEnding =
  'done' | 'cancelled' | 'disconnected' | 'input-lost' | 'refused' | 'failed';

export interface IdentifyOutcome {
  /** One result per track, in the order given. */
  readonly results: readonly TrackResult[];
  readonly ending: IdentifyEnding;
}

export interface IdentifyOptions {
  readonly deck: RecordingDeck;
  /** An open capture of the chosen input; the caller closes it. */
  readonly capture: LiveCapture;
  readonly identifier: Identifier;
  readonly sleep: (ms: number) => Promise<void>;
  /** Aborting with `'disconnected'` reports an unplugged device; any other reason is a cancel. */
  readonly signal: AbortSignal;
  readonly onProgress?: (progress: IdentifyProgress) => void;
  /** Called as each track gets its result. */
  readonly onResult?: (position: number, result: TrackResult) => void;
}

class DeckRefused extends Error {}

/**
 * Identifies tracks by listening to the deck: each track is started from its beginning, and
 * excerpts are captured one after another while it plays, the next one while the previous is
 * being asked about, until a song is found or the attempts run out. The deck is stopped when it
 * ends, however it ends; a cancel does not wait for a pending answer.
 */
export async function identifyTracks(
  tracks: readonly RecordingTrack[],
  options: IdentifyOptions,
): Promise<IdentifyOutcome> {
  const { deck, signal } = options;
  const results: TrackResult[] = tracks.map(() => ({ kind: 'none' }));
  const send = async (command: PlaybackCommand) => {
    if (!(await deck.control(command)).ok) throw new DeckRefused();
  };
  let ending: IdentifyEnding = 'done';
  try {
    await send({ kind: 'stop' });
    for (const [position, track] of tracks.entries()) {
      signal.throwIfAborted();
      const result = await identifyTrack(track, position, tracks.length, options, send);
      results[position] = result;
      options.onResult?.(position, result);
    }
  } catch (error) {
    ending = endingFor(error, signal);
  } finally {
    await deck.control({ kind: 'stop' }).catch(() => undefined);
  }
  return { results: [...results], ending };
}

async function identifyTrack(
  track: RecordingTrack,
  position: number,
  total: number,
  options: IdentifyOptions,
  send: (command: PlaybackCommand) => Promise<void>,
): Promise<TrackResult> {
  const { capture, identifier, signal } = options;
  const plan = identifier.plan(track.seconds);
  if (plan === 'too-short') return { kind: 'too-short' };
  const title = track.title || track.fullWidthTitle || `Track ${String(track.index + 1)}`;
  const report = (stage: IdentifyProgress['stage']) => {
    options.onProgress?.({ position, total, title, stage });
  };
  const frames = Math.ceil(plan.excerptSeconds * capture.sampleRate);
  const listening = new AbortController();
  const listen = () => recordFrames(capture, frames, AbortSignal.any([signal, listening.signal]));

  report('listening');
  await prime(track.index, options, send);
  let next: Promise<PcmBuffer> | null = listen();
  await send({ kind: 'play' });
  try {
    for (let attempt = 0; attempt < plan.attempts; attempt++) {
      report('listening');
      const excerpt: PcmBuffer = await (next ?? listen());
      // The next excerpt starts at once, so the deck plays on while this one is asked about.
      next = attempt + 1 < plan.attempts ? listen() : null;
      report('asking');
      const song = await answer(
        identifier.identify(excerpt, capture.sampleRate, track.seconds, signal),
        signal,
      );
      if (song === 'unreachable') return { kind: 'unreachable' };
      if (song !== null) return { kind: 'found', song };
    }
    return { kind: 'not-found' };
  } finally {
    listening.abort();
    // An excerpt no longer wanted ends with an abort, which nobody needs to hear about.
    next?.catch(() => undefined);
  }
}

/**
 * The identifier's answer, or 'unreachable' when its service could not be reached. A cancel
 * rejects at once, without waiting for the answer, which is then ignored.
 */
function answer(
  pending: Promise<Song | null>,
  signal: AbortSignal,
): Promise<Song | null | 'unreachable'> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Identification was cancelled', 'AbortError'));
    };
    if (signal.aborted) onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(
      (song) => {
        signal.removeEventListener('abort', onAbort);
        resolve(song);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (error instanceof ServiceUnreachableError) resolve('unreachable');
        else reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function endingFor(error: unknown, signal: AbortSignal): IdentifyEnding {
  if (signal.aborted) return signal.reason === 'disconnected' ? 'disconnected' : 'cancelled';
  if (error instanceof InputLostError) return 'input-lost';
  if (error instanceof DeckRefused) return 'refused';
  console.error('mdconnect: identification stopped', error);
  return 'failed';
}
