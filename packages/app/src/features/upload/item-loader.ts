import type { UploadMode } from '@mdconnect/netmd';

import { readAtracBlob } from './atrac-file';
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
  const atrac = await readAtracBlob(file);
  if (atrac !== null && atrac.kind !== 'atrac') {
    return { tags: {}, durationSeconds: 0, atrac: null, problem: 'not-supported' };
  }
  const tags = await dependencies.readTags(file);
  if (atrac !== null) {
    const frameBytes = FRAME_BYTES[atrac.mode] ?? 1;
    const seconds = ((atrac.data.length / frameBytes) * SAMPLES_PER_FRAME) / SAMPLE_RATE;
    return { tags, durationSeconds: seconds, atrac: atrac.mode, problem: null };
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

/** Like `loadItem`, but a file that cannot be read is marked unreadable instead of failing. */
export async function loadItemSafely(
  file: File,
  load: (file: File) => Promise<LoadedItem> = loadItem,
): Promise<LoadedItem> {
  try {
    return await load(file);
  } catch {
    return { tags: {}, durationSeconds: 0, atrac: null, problem: 'unreadable' };
  }
}
