import { uniqueFileName } from '@mdconnect/core';

import type { PlatformRecordingFolders, RecordingFolder } from '../../platform';

/** Bytes sent in one write: few enough calls for a long track, little memory for each. */
const DEFAULT_BATCH_BYTES = 4 * 1024 * 1024;

/** The part of a File System Access writable stream a recording folder uses. */
interface WritableLike {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

/** The part of a File System Access directory handle a recording folder uses. */
export interface DirectoryHandleLike {
  readonly name: string;
  getFileHandle(
    name: string,
    options?: { readonly create?: boolean },
  ): Promise<{ createWritable(): Promise<WritableLike> }>;
  removeEntry(name: string): Promise<void>;
}

/** The desktop app's recording calls, which take opaque ids and never a path. */
export interface RecordingFileBridge {
  chooseFolder(): Promise<{ readonly id: string; readonly name: string } | null>;
  create(
    folderId: string,
    fileName: string,
  ): Promise<{ readonly id: string; readonly name: string }>;
  append(fileId: string, bytes: Uint8Array): Promise<void>;
  finish(fileId: string): Promise<void>;
  discard(fileId: string): Promise<void>;
}

export interface FolderOptions {
  readonly batchBytes?: number;
}

/** A file being written in parts. */
interface PartWriter {
  append(bytes: Uint8Array): Promise<void>;
  finish(): Promise<void>;
  /** Removes what was written, for a file that will not be completed. */
  discard(): Promise<void>;
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/**
 * Writes the parts in order, joined into batches of about `batchBytes`. A write that fails or is
 * aborted discards the file, so no partial recording is left in the folder.
 */
async function writeParts(
  writer: PartWriter,
  parts: readonly Uint8Array[],
  batchBytes: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  try {
    for (const batch of batches(parts, batchBytes)) {
      signal?.throwIfAborted();
      await writer.append(batch);
    }
    signal?.throwIfAborted();
    await writer.finish();
  } catch (error) {
    await writer.discard().catch(() => undefined);
    throw error;
  }
}

/** Consecutive parts joined until they reach `batchBytes`; a larger part goes on its own. */
function* batches(parts: readonly Uint8Array[], batchBytes: number): Generator<Uint8Array> {
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  const flush = (): Uint8Array => {
    const [only] = pending;
    const batch = pending.length === 1 && only !== undefined ? only : join(pending, pendingBytes);
    pending = [];
    pendingBytes = 0;
    return batch;
  };
  for (const part of parts) {
    pending.push(part);
    pendingBytes += part.byteLength;
    if (pendingBytes >= batchBytes) yield flush();
  }
  if (pending.length > 0) yield flush();
}

function join(parts: readonly Uint8Array[], byteLength: number): Uint8Array {
  const joined = new Uint8Array(byteLength);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return joined;
}

async function fileExists(directory: DirectoryHandleLike, name: string): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return false;
    throw error;
  }
}

/** A folder from the File System Access API that never overwrites a file. */
function directoryFolder(directory: DirectoryHandleLike, batchBytes: number): RecordingFolder {
  return {
    name: directory.name,
    async write(fileName, parts, signal) {
      const taken = new Set<string>();
      let name = uniqueFileName(fileName, (candidate) => taken.has(candidate));
      while (await fileExists(directory, name)) {
        taken.add(name);
        name = uniqueFileName(fileName, (candidate) => taken.has(candidate));
      }
      const writable = await (
        await directory.getFileHandle(name, { create: true })
      ).createWritable();
      await writeParts(
        {
          append: (bytes) => writable.write(bytes),
          finish: () => writable.close(),
          discard: async () => {
            await writable.abort().catch(() => undefined);
            await directory.removeEntry(name);
          },
        },
        parts,
        batchBytes,
        signal,
      );
      return name;
    },
  };
}

/**
 * Recording folders picked with the File System Access API (`showDirectoryPicker` in Chromium
 * browsers). A cancelled picker resolves null.
 */
export function directoryRecordingFolders(
  pick: () => Promise<DirectoryHandleLike>,
  { batchBytes = DEFAULT_BATCH_BYTES }: FolderOptions = {},
): PlatformRecordingFolders {
  return {
    async choose() {
      try {
        return directoryFolder(await pick(), batchBytes);
      } catch (error) {
        if (isAbort(error)) return null;
        throw error;
      }
    },
  };
}

/**
 * Recording folders picked in the desktop app's native dialog. Each file is written in batches,
 * so a long track never crosses the bridge whole, and is removed if it cannot be completed.
 */
export function bridgeRecordingFolders(
  bridge: RecordingFileBridge,
  { batchBytes = DEFAULT_BATCH_BYTES }: FolderOptions = {},
): PlatformRecordingFolders {
  return {
    async choose() {
      const folder = await bridge.chooseFolder();
      if (folder === null) return null;
      return {
        name: folder.name,
        async write(fileName, parts, signal) {
          const file = await bridge.create(folder.id, fileName);
          await writeParts(
            {
              append: (bytes) => bridge.append(file.id, bytes),
              finish: () => bridge.finish(file.id),
              discard: () => bridge.discard(file.id),
            },
            parts,
            batchBytes,
            signal,
          );
          return file.name;
        },
      };
    },
  };
}
