import { randomUUID } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { isSafeFileName, uniqueFileName } from '@mdconnect/core';

import { dialog, ipcMain, type BrowserWindow } from 'electron';

import { IPC, type RecordingFolderPayload } from '../shared/ipc';
import { isAppOrigin, type OriginContext } from './url-policy';

export interface RecordingFolderDependencies {
  /** Shows the native folder dialog; null when the user cancels. */
  readonly pickFolder: () => Promise<string | null>;
  readonly newId: () => string;
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/**
 * Folders the user picked for recordings, kept behind opaque ids so the page never sees or sends
 * a path. Files are written only into a picked folder, under a checked name, never over a file.
 */
export class RecordingFolders {
  private readonly paths = new Map<string, string>();

  constructor(private readonly dependencies: RecordingFolderDependencies) {}

  async choose(): Promise<RecordingFolderPayload | null> {
    const path = await this.dependencies.pickFolder();
    if (path === null) return null;
    const id = this.dependencies.newId();
    this.paths.set(id, path);
    return { id, name: basename(path) };
  }

  /** Writes `bytes` as `fileName` in the folder, or under a free variant of it; returns the name used. */
  async write(folderId: string, fileName: string, bytes: Uint8Array): Promise<string> {
    const folder = this.paths.get(folderId);
    if (folder === undefined) throw new Error('No recording folder was picked');
    if (!isSafeFileName(fileName)) throw new Error('The file name is not allowed');
    const taken = new Set<string>();
    // Checked one name at a time on disk; `wx` refuses to replace a file created meanwhile.
    for (;;) {
      const name = uniqueFileName(fileName, (candidate) => taken.has(candidate));
      if (await exists(join(folder, name))) {
        taken.add(name);
        continue;
      }
      try {
        await writeFile(join(folder, name), bytes, { flag: 'wx' });
        return name;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        taken.add(name);
      }
    }
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
  const fromApp = (event: Electron.IpcMainInvokeEvent) =>
    isAppOrigin(event.senderFrame?.origin ?? '', origins);

  ipcMain.handle(IPC.recordingsChooseFolder, (event) => {
    if (!fromApp(event)) throw new Error('Not allowed');
    return folders.choose();
  });
  ipcMain.handle(
    IPC.recordingsWrite,
    (event, folderId: unknown, fileName: unknown, bytes: unknown) => {
      if (!fromApp(event)) throw new Error('Not allowed');
      if (
        typeof folderId !== 'string' ||
        typeof fileName !== 'string' ||
        !(bytes instanceof Uint8Array)
      ) {
        throw new Error('Bad recording write');
      }
      return folders.write(folderId, fileName, bytes);
    },
  );
}
