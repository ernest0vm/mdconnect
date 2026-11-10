/**
 * The messages between the built-in encoder and its worker. Kept free of other imports, so the
 * worker bundle holds only atracdenc and this file.
 */

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
