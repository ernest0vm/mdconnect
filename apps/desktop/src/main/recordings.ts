import { randomUUID } from 'node:crypto';
import { open, rm, type FileHandle } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { isSafeFileName, uniqueFileName } from '@mdconnect/core';
import { dialog, ipcMain, type BrowserWindow, type WebContents } from 'electron';

import { IPC, type RecordingFilePayload, type RecordingFolderPayload } from '../shared/ipc';
import { isAppOrigin, type OriginContext } from './url-policy';

export interface RecordingFolderDependencies {
  /** Shows the native folder dialog; null when the user cancels. */
  readonly pickFolder: () => Promise<string | null>;
  readonly newId: () => string;
}

interface OpenFile {
  readonly handle: FileHandle;
  readonly path: string;
  /** The page that opened the file. */
  readonly owner: number;
}

/**
 * Folders the user picked for recordings, and the files being written into them, kept behind
 * opaque ids so the page never sees or sends a path. Files are created only in a picked folder,
 * under a checked name, never over a file, and written in parts so a long recording is never
 * copied whole through IPC.
 */
export class RecordingFolders {
  private readonly paths = new Map<string, string>();
  private readonly files = new Map<string, OpenFile>();
  /** How many times each page went away, so a file it was still creating can be dropped. */
  private readonly departures = new Map<number, number>();

  constructor(private readonly dependencies: RecordingFolderDependencies) {}

  async choose(): Promise<RecordingFolderPayload | null> {
    const path = await this.dependencies.pickFolder();
    if (path === null) return null;
    const id = this.dependencies.newId();
    this.paths.set(id, path);
    return { id, name: basename(path) };
  }

  /**
   * Opens a new file in the folder under `fileName`, or a free variant of it, for writing in
   * parts; resolves with the file's id and the name it got. An existing file is never opened.
   */
  async create(folderId: string, fileName: string, owner = 0): Promise<RecordingFilePayload> {
    const folder = this.paths.get(folderId);
    if (folder === undefined) throw new Error('No recording folder was picked');
    if (!isSafeFileName(fileName)) throw new Error('The file name is not allowed');
    const departures = this.departures.get(owner) ?? 0;
    const taken = new Set<string>();
    for (;;) {
      const name = uniqueFileName(fileName, (candidate) => taken.has(candidate));
      const path = join(folder, name);
      try {
        // `wx` creates the file only if no file has the name, even one made a moment ago.
        const handle = await open(path, 'wx');
        if ((this.departures.get(owner) ?? 0) !== departures) {
          // The page went away while the file was being created, so nobody will finish it.
          await handle.close().catch(() => undefined);
          await rm(path, { force: true });
          throw new Error('The page that asked for the file is gone');
        }
        const id = this.dependencies.newId();
        this.files.set(id, { handle, path, owner });
        return { id, name };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        taken.add(name);
      }
    }
  }

  async append(fileId: string, bytes: Uint8Array): Promise<void> {
    const { handle } = this.file(fileId);
    // A write may take only part of the bytes, so it is repeated until all of them are written.
    for (let offset = 0; offset < bytes.byteLength;) {
      const { bytesWritten } = await handle.write(bytes, offset, bytes.byteLength - offset);
      offset += bytesWritten;
    }
  }

  /**
   * Closes a file that is complete. If closing fails the file stays open here, so a `discard`
   * that follows can still remove it.
   */
  async finish(fileId: string): Promise<void> {
    await this.file(fileId).handle.close();
    this.files.delete(fileId);
  }

  /** Closes and removes a file that will not be completed, so no partial recording is left. */
  async discard(fileId: string): Promise<void> {
    const file = this.files.get(fileId);
    if (file === undefined) return;
    this.files.delete(fileId);
    await file.handle.close().catch(() => undefined);
    await rm(file.path, { force: true });
  }

  /** Discards the files a page still has open, for a page that reloaded, crashed or closed. */
  async discardOwnedBy(owner: number): Promise<void> {
    this.departures.set(owner, (this.departures.get(owner) ?? 0) + 1);
    const owned = [...this.files].filter(([, file]) => file.owner === owner);
    await Promise.all(owned.map(([fileId]) => this.discard(fileId)));
  }

  private file(fileId: string): OpenFile {
    const file = this.files.get(fileId);
    if (file === undefined) throw new Error('No such recording file is open');
    return file;
  }
}

/**
 * Answers the page's recording-folder calls: the native folder dialog and writes into a picked
 * folder. Calls from any other origin are refused.
 */
export function installRecordingHandlers(
  window: () => BrowserWindow | null,
  origins: OriginContext,
): void {
  const folders = new RecordingFolders({
    pickFolder: async () => {
      const options: Electron.OpenDialogOptions = {
        title: 'Choose a folder for the recordings',
        properties: ['openDirectory', 'createDirectory'],
      };
      const owner = window();
      const result = await (owner === null
        ? dialog.showOpenDialog(options)
        : dialog.showOpenDialog(owner, options));
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    newId: randomUUID,
  });
  const handle = (
    channel: string,
    run: (page: WebContents, ...args: unknown[]) => Promise<unknown>,
  ) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isAppOrigin(event.senderFrame?.origin ?? '', origins)) throw new Error('Not allowed');
      return run(event.sender, ...args);
    });
  };
  // A page that goes away never finishes its files, so they are removed instead of left partial.
  const watched = new WeakSet<WebContents>();
  const discardWhenGone = (page: WebContents) => {
    if (watched.has(page)) return;
    watched.add(page);
    const id = page.id;
    const discard = () => {
      void folders.discardOwnedBy(id);
    };
    page.on('render-process-gone', discard);
    page.on('did-navigate', discard);
    page.on('destroyed', discard);
  };
  const text = (value: unknown): string => {
    if (typeof value !== 'string') throw new Error('Bad recording call');
    return value;
  };
  handle(IPC.recordingsChooseFolder, () => folders.choose());
  handle(IPC.recordingsCreate, (page, folderId, fileName) => {
    discardWhenGone(page);
    return folders.create(text(folderId), text(fileName), page.id);
  });
  handle(IPC.recordingsAppend, (_page, fileId, bytes) => {
    if (!(bytes instanceof Uint8Array)) throw new Error('Bad recording call');
    return folders.append(text(fileId), bytes);
  });
  handle(IPC.recordingsFinish, (_page, fileId) => folders.finish(text(fileId)));
  handle(IPC.recordingsDiscard, (_page, fileId) => folders.discard(text(fileId)));
}
