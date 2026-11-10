/*
 * LP2 and LP4 encoders. The built-in one follows webminidisc's atracdenc encoder
 * (encoders/atracdenc), and the online one its remote encoder (encoders/remote-encoder),
 * https://github.com/asivery/webminidisc, GPL-2.0.
 *
 * Changes from upstream: atracdenc writes raw ATRAC3 frames (`--container raw`), so no header is
 * stripped; each track gets a fresh worker; and the online encoder's address is fixed, since the
 * Content Security Policy allows only that origin.
 */

import { ONLINE_ENCODER_ORIGIN } from '@mdconnect/core';

import { readAtracFile } from './atrac-file';
import { wavFile } from './pcm';

export type LpMode = 'lp2' | 'lp4';

/** What `atracdenc.worker.ts` receives and answers. */
export interface EncodeRequest {
  readonly wav: ArrayBuffer;
  readonly mode: LpMode;
}
export type EncodeReply =
  | { readonly ok: true; readonly data: ArrayBuffer }
  | { readonly ok: false; readonly message: string };

/** atracdenc's command line for a mode, reading `in.wav` and writing raw frames to `out.raw`. */
export function atracdencArguments(mode: LpMode): string[] {
  const codec = mode === 'lp2' ? ['-e', 'atrac3', '--bitrate', '128'] : ['-e', 'atrac3_lp4'];
  return [...codec, '--container', 'raw', '-i', 'in.wav', '-o', 'out.raw', '--nostdout'];
}

/** The part of `Worker` the built-in encoder uses. */
export interface EncoderWorker {
  onmessage: ((event: MessageEvent<EncodeReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: EncodeRequest, transfer: Transferable[]): void;
  terminate(): void;
}

const startWorker = (): EncoderWorker =>
  new Worker(new URL('./atracdenc.worker.ts', import.meta.url), { type: 'module' });

/** Encodes with atracdenc in a worker, offline. Its quality is lower than Sony's encoder. */
export class BuiltInEncoder {
  constructor(private readonly worker: () => EncoderWorker = startWorker) {}

  /** Encodes 16-bit little-endian stereo PCM at 44.1 kHz into raw ATRAC3 frames. */
  async encode(pcm: Uint8Array, mode: LpMode): Promise<Uint8Array<ArrayBuffer>> {
    const worker = this.worker();
    try {
      const wav = wavFile(pcm).buffer;
      const reply = await new Promise<EncodeReply>((resolve, reject) => {
        worker.onmessage = (event) => {
          resolve(event.data);
        };
        worker.onerror = (event) => {
          reject(new Error(event.message || 'The built-in encoder stopped'));
        };
        worker.postMessage({ wav, mode }, [wav]);
      });
      if (!reply.ok) throw new Error(`The built-in encoder failed: ${reply.message}`);
      return new Uint8Array(reply.data);
    } finally {
      worker.terminate();
    }
  }
}

/** The online encoder could not encode a track after every attempt. */
export class OnlineEncoderUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('The online encoder is not available', options);
    this.name = 'OnlineEncoderUnavailableError';
  }
}

const ONLINE_ATTEMPTS = 3;
const ONLINE_TYPES: Readonly<Record<LpMode, string>> = { lp2: 'LP2', lp4: 'LP4' };

type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Encodes with Sony's encoder through the online ATRAC service: the original file is sent, and
 * the ATRAC3 frames come back in a WAV. Only call it after the user agreed to send the file.
 */
export async function encodeOnline(
  file: Blob,
  fileName: string,
  mode: LpMode,
  options: { readonly replayGain: boolean },
  fetchImpl: FetchFunction = (url, init) => fetch(url, init),
): Promise<Uint8Array> {
  const url = new URL('/transcode', ONLINE_ENCODER_ORIGIN);
  url.searchParams.set('type', ONLINE_TYPES[mode]);
  if (options.replayGain) url.searchParams.set('applyReplaygain', 'true');
  const body = new FormData();
  body.append('file', file, fileName);

  let lastError: unknown;
  for (let attempt = 0; attempt < ONLINE_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url.href, { method: 'POST', body });
      if (!response.ok) throw new Error(`The online encoder answered ${String(response.status)}`);
      const encoded = readAtracFile(new Uint8Array(await response.arrayBuffer()));
      if (encoded?.kind !== 'atrac') throw new Error('The online encoder sent no ATRAC3 audio');
      return encoded.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw new OnlineEncoderUnavailableError({ cause: lastError });
}
