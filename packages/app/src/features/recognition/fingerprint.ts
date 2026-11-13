import type { MainModule } from '@unimusic/chromaprint/dist/chromaprint.js';

/** A Chromaprint fingerprint of 16-bit PCM, compressed and base64-encoded as AcoustID expects. */
export type Fingerprinter = (
  /** The interleaved samples in parts, as the capture keeps them. */
  chunks: readonly Int16Array[],
  sampleRate: number,
  channels: number,
) => Promise<string>;

/** The part of Chromaprint's WebAssembly module the fingerprinter calls. */
export type ChromaprintApi = Pick<
  MainModule,
  | '_chromaprint_new'
  | '_chromaprint_free'
  | '_chromaprint_start'
  | '_chromaprint_feed'
  | '_chromaprint_finish'
  | '_chromaprint_get_fingerprint'
  | '_malloc'
  | '_free'
  | 'HEAP16'
  | 'HEAP32'
  | 'UTF8ToString'
>;

/** `CHROMAPRINT_ALGORITHM_TEST2`, Chromaprint's default and the one AcoustID's database uses. */
const DEFAULT_ALGORITHM = 1;

/**
 * Loads Chromaprint compiled to WebAssembly (`@unimusic/chromaprint`). The module is instantiated
 * through Vite's `?init` import instead of the package's own loader, which reads the file from a
 * URL next to the script; no `AudioContext` is created.
 */
export async function loadChromaprint(): Promise<ChromaprintApi> {
  const [{ default: createModule }, { default: instantiate }] = await Promise.all([
    import('@unimusic/chromaprint/dist/chromaprint.js'),
    import('@unimusic/chromaprint/dist/chromaprint.wasm?init'),
  ]);
  // Emscripten's factory never settles when the instantiation fails, so that failure rejects here.
  return new Promise((resolve, reject) => {
    createModule({
      instantiateWasm(
        imports: WebAssembly.Imports,
        receive: (instance: WebAssembly.Instance) => void,
      ): Record<string, never> {
        instantiate(imports).then(receive, reject);
        return {};
      },
    }).then(resolve, reject);
  });
}

/**
 * Fingerprints PCM with Chromaprint's C API. The module is loaded on the first call and kept; each
 * call frees its context, its sample buffer and the fingerprint string, however it ends.
 */
export function chromaprintFingerprinter(load: () => Promise<ChromaprintApi>): Fingerprinter {
  let module: Promise<ChromaprintApi> | null = null;
  return async (chunks, sampleRate, channels) => {
    // A failed load is forgotten, so the next call tries again.
    module ??= load().catch((error: unknown) => {
      module = null;
      throw error;
    });
    return fingerprint(await module, chunks, sampleRate, channels);
  };
}

function fingerprint(
  api: ChromaprintApi,
  chunks: readonly Int16Array[],
  sampleRate: number,
  channels: number,
): string {
  const context = api._chromaprint_new(DEFAULT_ALGORITHM);
  // One buffer the size of the largest part, reused for each, instead of a copy of the whole.
  const largest = chunks.reduce((bytes, chunk) => Math.max(bytes, chunk.byteLength), 0);
  const samples = api._malloc(Math.max(largest, 2));
  const pointerToText = api._malloc(4);
  let text = 0;
  try {
    let ok = api._chromaprint_start(context, sampleRate, channels) === 1;
    for (const chunk of chunks) {
      if (!ok) break;
      // Read the heap after allocating: a growing memory replaces the views.
      (api.HEAP16 as Int16Array).set(chunk, samples >> 1);
      ok = api._chromaprint_feed(context, samples, chunk.length) === 1;
    }
    ok =
      ok &&
      api._chromaprint_finish(context) === 1 &&
      api._chromaprint_get_fingerprint(context, pointerToText) === 1;
    if (!ok) throw new Error('Chromaprint could not fingerprint the audio');
    text = (api.HEAP32 as Int32Array)[pointerToText >> 2] ?? 0;
    return api.UTF8ToString(text);
  } finally {
    if (text !== 0) api._free(text);
    api._free(pointerToText);
    api._free(samples);
    api._chromaprint_free(context);
  }
}
