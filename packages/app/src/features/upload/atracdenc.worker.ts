/**
 * Runs atracdenc (vendor/atracdenc) on one track and posts the raw ATRAC3 frames back. The module
 * is loaded only here, so the 1 MB encoder is fetched only when LP is chosen, and each track gets a
 * fresh instance that is dropped with the worker.
 */

import type { AtracdencModule } from '../../../vendor/atracdenc/atracdenc.mjs';
import { atracdencArguments, type EncodeReply, type EncodeRequest } from './atracdenc-protocol';

interface WorkerScope {
  onmessage: ((event: MessageEvent<EncodeRequest>) => void) | null;
  postMessage(message: EncodeReply, transfer?: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

async function encode({ wav, mode }: EncodeRequest): Promise<Uint8Array<ArrayBuffer>> {
  const errors: string[] = [];
  const { default: createAtracdenc } = await import('../../../vendor/atracdenc/atracdenc.mjs');
  const atracdenc: AtracdencModule = await createAtracdenc({
    print: () => undefined,
    printErr: (text) => errors.push(text),
  });
  atracdenc.FS.writeFile('in.wav', new Uint8Array(wav));
  const status = atracdenc.callMain(atracdencArguments(mode));
  if (status !== 0) throw new Error(errors.join(' ') || `atracdenc exited with ${String(status)}`);
  return atracdenc.FS.readFile('out.raw');
}

scope.onmessage = (event) => {
  encode(event.data).then(
    (frames) => {
      scope.postMessage({ ok: true, data: frames.buffer }, [frames.buffer]);
    },
    (error: unknown) => {
      scope.postMessage({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    },
  );
};
