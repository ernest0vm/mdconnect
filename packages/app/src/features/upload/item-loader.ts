import type { UploadMode } from '@mdconnect/netmd';

import { readAtracFile } from './atrac-file';
import { decodeAudio } from './decode';
import { SAMPLE_RATE } from './pcm';
import { readTags, type AudioTags } from './tags';
import type { ConvertItem } from './upload-view';

export interface LoaderDependencies {
  readonly readTags: (file: Blob) => Promise<AudioTags>;
  /** The length of a file in seconds, by decoding it. */
  readonly measure: (file: File) => Promise<number>;
}

const browserDependencies: LoaderDependencies = {
  readTags,
  measure: async (file) => (await decodeAudio(await file.arrayBuffer())).durationSeconds,
};

const HEADER_PROBE_BYTES = 64 * 1024;
const SAMPLES_PER_FRAME = 1024;
/** Bytes per 1024-sample stereo frame in each pre-encoded mode. */
const FRAME_BYTES: Partial<Record<UploadMode, number>> = { lp2: 384, lp105: 304, lp4: 192 };

export type LoadedItem = Pick<ConvertItem, 'tags' | 'durationSeconds' | 'atrac' | 'problem'>;

/**
 * Reads what the convert dialog needs about a file: its tags and length, and whether it is
 * pre-encoded ATRAC3. A file whose tags give no length is decoded to measure it.
 */
export async function loadItem(
  file: File,
  dependencies: LoaderDependencies = browserDependencies,
): Promise<LoadedItem> {
  const probe = readAtracFile(
    new Uint8Array(await file.slice(0, HEADER_PROBE_BYTES).arrayBuffer()),
  );
  if (probe !== null && probe.kind !== 'atrac') {
    return { tags: {}, durationSeconds: 0, atrac: null, problem: 'not-supported' };
  }
  const tags = await dependencies.readTags(file);
  if (probe?.kind === 'atrac') {
    const atrac = readAtracFile(new Uint8Array(await file.arrayBuffer()));
    const frameBytes = FRAME_BYTES[probe.mode] ?? 1;
    const length = atrac?.kind === 'atrac' ? atrac.data.length : 0;
    const seconds = ((length / frameBytes) * SAMPLES_PER_FRAME) / SAMPLE_RATE;
    return { tags, durationSeconds: seconds, atrac: probe.mode, problem: null };
  }
  if (tags.durationSeconds !== undefined) {
    return { tags, durationSeconds: tags.durationSeconds, atrac: null, problem: null };
  }
  try {
    return { tags, durationSeconds: await dependencies.measure(file), atrac: null, problem: null };
  } catch {
    return { tags, durationSeconds: 0, atrac: null, problem: 'not-decodable' };
  }
}
