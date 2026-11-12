import { uniqueFileName } from '@mdconnect/core';

import type { PlatformRecordingFolders, RecordingFolder } from '../../platform';

/** The part of a File System Access directory handle a recording folder uses. */
export interface DirectoryHandleLike {
  readonly name: string;
  getFileHandle(
    name: string,
    options?: { readonly create?: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

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
function directoryFolder(directory: DirectoryHandleLike): RecordingFolder {
  return {
    name: directory.name,
    async write(fileName, data) {
      const taken = new Set<string>();
      for (;;) {
        const name = uniqueFileName(fileName, (candidate) => taken.has(candidate));
        if (await fileExists(directory, name)) {
          taken.add(name);
          continue;
        }
        const writable = await (
          await directory.getFileHandle(name, { create: true })
        ).createWritable();
        await writable.write(data);
        await writable.close();
        return name;
      }
    },
  };
}

/**
 * Recording folders picked with the File System Access API (`showDirectoryPicker` in Chromium
 * browsers). A cancelled picker resolves null.
 */
export function directoryRecordingFolders(
  pick: () => Promise<DirectoryHandleLike>,
): PlatformRecordingFolders {
  return {
    async choose() {
      try {
        return directoryFolder(await pick());
      } catch (error) {
        if (isAbort(error)) return null;
        throw error;
      }
    },
  };
}
