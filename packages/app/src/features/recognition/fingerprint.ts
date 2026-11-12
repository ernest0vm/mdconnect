import type { MainModule } from '@unimusic/chromaprint/dist/chromaprint.js';

/** A Chromaprint fingerprint of 16-bit PCM, compressed and base64-encoded as AcoustID expects. */
export type Fingerprinter = (
  pcm: Int16Array,
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
  return createModule({
    instantiateWasm(
      imports: WebAssembly.Imports,
      receive: (instance: WebAssembly.Instance) => void,
    ): Record<string, never> {
      void instantiate(imports).then(receive);
      return {};
    },
  });
}

/**
 * Fingerprints PCM with Chromaprint's C API. The module is loaded on the first call and kept; each
 * call frees its context, its sample buffer and the fingerprint string, however it ends.
 */
export function chromaprintFingerprinter(load: () => Promise<ChromaprintApi>): Fingerprinter {
  let module: Promise<ChromaprintApi> | null = null;
  return async (pcm, sampleRate, channels) => {
    module ??= load();
    return fingerprint(await module, pcm, sampleRate, channels);
  };
}

function fingerprint(
  api: ChromaprintApi,
  pcm: Int16Array,
  sampleRate: number,
  channels: number,
): string {
  const context = api._chromaprint_new(DEFAULT_ALGORITHM);
  const samples = api._malloc(pcm.byteLength);
  const pointerToText = api._malloc(4);
  let text = 0;
  try {
    // Read the heap after allocating: a growing memory replaces the views.
    (api.HEAP16 as Int16Array).set(pcm, samples >> 1);
    const ok =
      api._chromaprint_start(context, sampleRate, channels) === 1 &&
      api._chromaprint_feed(context, samples, pcm.length) === 1 &&
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
