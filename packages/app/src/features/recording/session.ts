import type { DeviceStatus } from '@mdconnect/netmd';

import type { RecordingFolder } from '../../platform';
import type { PlaybackCommand } from '../disc/disc-reader';
import { InputLostError, recordFrames } from './capture';
import type { LiveCapture } from './capture-source';
import { recordingFileName } from './file-name';
import { wavBlob, wavParts } from './wav';

/** Captured after each track's length, for the deck's start delay and the analogue path. */
const MARGIN_SECONDS = 1.5;
const PRIME_POLL_MS = 250;
const PRIME_TIMEOUT_MS = 10_000;

/** The deck controls a recording needs, each run in the reader's queue. */
export interface RecordingDeck {
  control(command: PlaybackCommand): Promise<{ readonly ok: boolean }>;
  status(): Promise<DeviceStatus | null>;
}

export interface RecordingTrack {
  /** Zero-based position on the disc. */
  readonly index: number;
  readonly title: string;
  readonly fullWidthTitle: string;
  readonly seconds: number;
}

export type RecordingSave =
  | { readonly kind: 'folder'; readonly folder: RecordingFolder }
  | { readonly kind: 'download'; readonly download: (fileName: string, data: Blob) => void };

/** Where the recording is: the track's place in the list, and how much of it is captured. */
export interface RecordingProgress {
  /** Zero-based place in the list being recorded. */
  readonly position: number;
  readonly total: number;
  readonly title: string;
  /** From 0 to 1. */
  readonly share: number;
}

export type RecordingEnding =
  'done' | 'cancelled' | 'disconnected' | 'input-lost' | 'refused' | 'save-failed' | 'failed';

export interface RecordingSummary {
  /** Names of the files saved, in order. */
  readonly saved: readonly string[];
  /** The folder's name, or null when the files were downloaded. */
  readonly folder: string | null;
  /** Files whose audio went past full scale. */
  readonly clipped: readonly string[];
  readonly ending: RecordingEnding;
}

export interface RecordingOptions {
  readonly deck: RecordingDeck;
  /** An open capture of the chosen input; the recording closes it when it ends. */
  readonly capture: LiveCapture;
  readonly trackCount: number;
  readonly save: RecordingSave;
  readonly sleep: (ms: number) => Promise<void>;
  /** Aborting with `'disconnected'` reports an unplugged device; any other reason is a cancel. */
  readonly signal: AbortSignal;
  readonly onProgress?: (progress: RecordingProgress) => void;
}

class DeckRefused extends Error {}

/** A file that could not be written, kept apart from deck and input failures. */
class SaveFailed extends Error {}

/** Writes a file to the folder; a failure that is not a cancel becomes a `SaveFailed`. */
async function writeFile(
  folder: RecordingFolder,
  name: string,
  parts: readonly Uint8Array[],
  signal: AbortSignal,
): Promise<string> {
  try {
    return await folder.write(name, parts, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new SaveFailed('A recording file could not be written', { cause: error });
  }
}

/**
 * Records tracks from the deck's output, one file each. Every track is started from its
 * beginning (played until the deck reports it, paused, sent back to its start), then captured
 * while it plays for its length plus a margin. The deck is stopped when the recording ends,
 * however it ends.
 */
export async function recordTracks(
  tracks: readonly RecordingTrack[],
  options: RecordingOptions,
): Promise<RecordingSummary> {
  const { deck, capture, save, signal } = options;
  const saved: string[] = [];
  const clipped: string[] = [];
  const send = async (command: PlaybackCommand) => {
    if (!(await deck.control(command)).ok) throw new DeckRefused();
  };
  let ending: RecordingEnding = 'done';
  try {
    await send({ kind: 'stop' });
    for (const [position, track] of tracks.entries()) {
      signal.throwIfAborted();
      const title = track.title || track.fullWidthTitle || `Track ${String(track.index + 1)}`;
      options.onProgress?.({ position, total: tracks.length, title, share: 0 });
      await prime(track.index, options, send);
      const frames = Math.ceil((track.seconds + MARGIN_SECONDS) * capture.sampleRate);
      const recording = recordFrames(capture, frames, signal, (share) => {
        options.onProgress?.({ position, total: tracks.length, title, share });
      });
      await send({ kind: 'play' });
      const pcm = await recording;
      signal.throwIfAborted();
      const name = recordingFileName(track, options.trackCount);
      const savedAs =
        save.kind === 'folder'
          ? await writeFile(save.folder, name, wavParts(pcm, capture.sampleRate), signal)
          : name;
      if (save.kind === 'download') save.download(name, wavBlob(pcm, capture.sampleRate));
      saved.push(savedAs);
      if (pcm.clipped) clipped.push(savedAs);
      // A file finished just as Cancel was pressed is complete, so it is kept and listed.
      signal.throwIfAborted();
    }
  } catch (error) {
    ending = endingFor(error, signal);
  } finally {
    await deck.control({ kind: 'stop' }).catch(() => undefined);
    await capture.close().catch((error: unknown) => {
      console.error('mdconnect: the audio input did not close', error);
    });
  }
  return { saved, folder: save.kind === 'folder' ? save.folder.name : null, clipped, ending };
}

/**
 * Plays the track until the deck reports it at its start, then pauses and sends it back, so the
 * real play starts at once instead of after the deck spins up and loads the track.
 */
async function prime(
  index: number,
  { deck, sleep, signal }: RecordingOptions,
  send: (command: PlaybackCommand) => Promise<void>,
): Promise<void> {
  await send({ kind: 'goto', track: index });
  await send({ kind: 'play' });
  for (let waited = 0; waited < PRIME_TIMEOUT_MS; waited += PRIME_POLL_MS) {
    signal.throwIfAborted();
    if (atTrackStart(await deck.status(), index)) break;
    await sleep(PRIME_POLL_MS);
  }
  await send({ kind: 'pause' });
  await send({ kind: 'goto', track: index });
}

function atTrackStart(status: DeviceStatus | null, index: number): boolean {
  return (
    status?.state === 'playing' &&
    status.track === index &&
    status.time !== null &&
    status.time.minute === 0 &&
    status.time.second <= 1
  );
}

/**
 * How a recording that threw ended. An abort wins over a refused command, since unplugging makes
 * the next command fail too. A file that could not be written ends it as save-failed, and
 * anything else (a deck that stopped answering) as failed, so the files already saved are still
 * reported.
 */
function endingFor(error: unknown, signal: AbortSignal): RecordingEnding {
  if (signal.aborted) return signal.reason === 'disconnected' ? 'disconnected' : 'cancelled';
  if (error instanceof InputLostError) return 'input-lost';
  if (error instanceof DeckRefused) return 'refused';
  if (error instanceof SaveFailed) {
    console.error('mdconnect: a recording file could not be written', error.cause);
    return 'save-failed';
  }
  console.error('mdconnect: the recording stopped', error);
  return 'failed';
}
