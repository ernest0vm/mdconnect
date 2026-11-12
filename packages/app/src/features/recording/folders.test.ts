import { describe, expect, it } from 'vitest';

import {
  bridgeRecordingFolders,
  directoryRecordingFolders,
  type DirectoryHandleLike,
  type RecordingFileBridge,
} from './folders';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);
const joined = (parts: readonly Uint8Array[]) => [...parts.flatMap((part) => [...part])];

/** A directory in memory, with the File System Access calls the folder uses. */
function fakeDirectory(
  name: string,
  existing: readonly string[] = [],
  fail: 'write' | 'open' | null = null,
  folders: readonly string[] = [],
  /** Names another program writes `other` into just as the folder creates them. */
  racers: readonly string[] = [],
) {
  const files = new Map<string, number[]>(existing.map((file) => [file, [...text('old')]]));
  const handle: DirectoryHandleLike = {
    name,
    getFileHandle(fileName, options) {
      if (folders.includes(fileName)) {
        return Promise.reject(new DOMException('a folder', 'TypeMismatchError'));
      }
      if (!files.has(fileName) && options?.create !== true) {
        return Promise.reject(new DOMException('missing', 'NotFoundError'));
      }
      if (!files.has(fileName)) {
        files.set(fileName, racers.includes(fileName) ? [...text('other')] : []);
      }
      // Like Chromium, the writes go to a swap file that replaces the file on close.
      const pending: number[] = [];
      return Promise.resolve({
        getFile: () => Promise.resolve({ size: files.get(fileName)?.length ?? 0 }),
        createWritable: () =>
          fail === 'open'
            ? Promise.reject(new DOMException('no permission', 'NotAllowedError'))
            : Promise.resolve({
                write: (data: Uint8Array) => {
                  if (fail === 'write') return Promise.reject(new Error('disk full'));
                  pending.push(...data);
                  return Promise.resolve();
                },
                close: () => {
                  files.set(fileName, pending);
                  return Promise.resolve();
                },
                abort: () => Promise.resolve(),
              }),
      });
    },
    removeEntry(fileName) {
      files.delete(fileName);
      return Promise.resolve();
    },
  };
  return { handle, files };
}

const cancelledPicker = () => Promise.reject(new DOMException('cancelled', 'AbortError'));

describe('directoryRecordingFolders', () => {
  it('asks for a folder once and writes each file into it (deck-recording: "Folder chosen once")', async () => {
    const { handle, files } = fakeDirectory('MiniDisc');
    let asked = 0;
    const folders = directoryRecordingFolders(() => {
      asked += 1;
      return Promise.resolve(handle);
    });
    const folder = await folders.choose();
    expect(folder?.name).toBe('MiniDisc');
    expect(await folder?.write('01 One.wav', [bytes(1, 2), bytes(3)])).toBe('01 One.wav');
    expect(await folder?.write('02 Two.wav', [bytes(4)])).toBe('02 Two.wav');
    expect(Object.fromEntries(files)).toEqual({ '01 One.wav': [1, 2, 3], '02 Two.wav': [4] });
    expect(asked).toBe(1);
  });

  it('never overwrites a file (deck-recording: "Name already taken")', async () => {
    const { handle, files } = fakeDirectory('MiniDisc', ['03 Dawn.wav']);
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    expect(await folder?.write('03 Dawn.wav', [text('new')])).toBe('03 Dawn (2).wav');
    expect(files.get('03 Dawn.wav')).toEqual([...text('old')]);
  });

  it('treats a folder with the file name as a taken name', async () => {
    const { handle, files } = fakeDirectory('MiniDisc', [], null, ['03 Dawn.wav']);
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    expect(await folder?.write('03 Dawn.wav', [text('new')])).toBe('03 Dawn (2).wav');
    expect([...files.keys()]).toEqual(['03 Dawn (2).wav']);
  });

  it('resolves null when the user cancels the picker (deck-recording: "Folder picking cancelled")', async () => {
    expect(await directoryRecordingFolders(cancelledPicker).choose()).toBeNull();
  });

  it('leaves no file behind when a write fails (deck-recording: "Unfinished file")', async () => {
    const { handle, files } = fakeDirectory('MiniDisc', [], 'write');
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    await expect(folder?.write('01 One.wav', [bytes(1)])).rejects.toThrow('disk full');
    expect(files.size).toBe(0);
  });

  it('leaves no empty file behind when the file cannot be opened for writing', async () => {
    const { handle, files } = fakeDirectory('MiniDisc', [], 'open');
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    await expect(folder?.write('01 One.wav', [bytes(1)])).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    expect(files.size).toBe(0);
  });

  it('never removes a file another program wrote under the name meanwhile', async () => {
    const { handle, files } = fakeDirectory('MiniDisc', [], 'write', [], ['01 One.wav']);
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    await expect(folder?.write('01 One.wav', [bytes(1)])).rejects.toThrow('disk full');
    expect(files.get('01 One.wav')).toEqual([...text('other')]);
  });

  it('leaves no file behind when the recording is cancelled while it is written', async () => {
    const { handle, files } = fakeDirectory('MiniDisc');
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    const cancel = new AbortController();
    cancel.abort();
    await expect(folder?.write('01 One.wav', [bytes(1)], cancel.signal)).rejects.toThrow();
    expect(files.size).toBe(0);
  });
});

/** The desktop bridge, recording each call. */
function fakeBridge(failAppend = false) {
  const calls: string[] = [];
  const written = new Map<string, Uint8Array[]>();
  const bridge: RecordingFileBridge = {
    chooseFolder: () => Promise.resolve({ id: 'folder-1', name: 'MiniDisc' }),
    create: (folderId, fileName) => {
      calls.push(`create ${folderId} ${fileName}`);
      written.set('file-1', []);
      return Promise.resolve({ id: 'file-1', name: fileName.replace('.wav', ' (2).wav') });
    },
    append: (fileId, data) => {
      calls.push(`append ${fileId} ${String(data.length)}`);
      if (failAppend) return Promise.reject(new Error('disk full'));
      written.get(fileId)?.push(data);
      return Promise.resolve();
    },
    finish: (fileId) => {
      calls.push(`finish ${fileId}`);
      return Promise.resolve();
    },
    discard: (fileId) => {
      calls.push(`discard ${fileId}`);
      return Promise.resolve();
    },
  };
  return { bridge, calls, written };
}

describe('bridgeRecordingFolders', () => {
  it('writes the parts in batches of about the batch size and resolves with the name given', async () => {
    const { bridge, calls, written } = fakeBridge();
    const folder = await bridgeRecordingFolders(bridge, { batchBytes: 4 }).choose();
    const parts = [bytes(1, 2, 3), bytes(4, 5, 6), bytes(7, 8, 9), bytes(10)];
    expect(folder?.name).toBe('MiniDisc');
    expect(await folder?.write('03 Dawn.wav', parts)).toBe('03 Dawn (2).wav');
    expect(calls).toEqual([
      'create folder-1 03 Dawn.wav',
      'append file-1 6',
      'append file-1 4',
      'finish file-1',
    ]);
    expect(joined(written.get('file-1') ?? [])).toEqual(joined(parts));
  });

  it('discards the file when a write fails', async () => {
    const { bridge, calls } = fakeBridge(true);
    const folder = await bridgeRecordingFolders(bridge).choose();
    await expect(folder?.write('01 One.wav', [bytes(1)])).rejects.toThrow('disk full');
    expect(calls.at(-1)).toBe('discard file-1');
  });

  it('discards the file when the recording is cancelled while it is written', async () => {
    const { bridge, calls } = fakeBridge();
    const folder = await bridgeRecordingFolders(bridge).choose();
    const cancel = new AbortController();
    cancel.abort();
    await expect(folder?.write('01 One.wav', [bytes(1)], cancel.signal)).rejects.toThrow();
    expect(calls).toEqual(['create folder-1 01 One.wav', 'discard file-1']);
  });

  it('resolves null when the user cancels the folder dialog', async () => {
    const { bridge } = fakeBridge();
    const folders = bridgeRecordingFolders({
      ...bridge,
      chooseFolder: () => Promise.resolve(null),
    });
    expect(await folders.choose()).toBeNull();
  });
});
