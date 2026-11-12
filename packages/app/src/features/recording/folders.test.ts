import { describe, expect, it } from 'vitest';

import { directoryRecordingFolders, type DirectoryHandleLike } from './folders';

/** A directory in memory, with the File System Access calls the folder uses. */
function fakeDirectory(name: string, existing: readonly string[] = []) {
  const files = new Map<string, Blob>(existing.map((file) => [file, new Blob(['old'])]));
  const handle: DirectoryHandleLike = {
    name,
    getFileHandle(fileName, options) {
      if (files.has(fileName) || options?.create === true) {
        return Promise.resolve({
          createWritable: () =>
            Promise.resolve({
              write: (data: Blob) => {
                files.set(fileName, data);
                return Promise.resolve();
              },
              close: () => Promise.resolve(),
            }),
        });
      }
      return Promise.reject(new DOMException('missing', 'NotFoundError'));
    },
  };
  return { handle, files };
}

const abort = () => Promise.reject(new DOMException('cancelled', 'AbortError'));

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
    expect(await folder?.write('01 One.wav', new Blob(['a']))).toBe('01 One.wav');
    expect(await folder?.write('02 Two.wav', new Blob(['b']))).toBe('02 Two.wav');
    expect([...files.keys()]).toEqual(['01 One.wav', '02 Two.wav']);
    expect(asked).toBe(1);
  });

  it('never overwrites a file (deck-recording: "Name already taken")', async () => {
    const { handle, files } = fakeDirectory('MiniDisc', ['03 Dawn.wav']);
    const folder = await directoryRecordingFolders(() => Promise.resolve(handle)).choose();
    expect(await folder?.write('03 Dawn.wav', new Blob(['new']))).toBe('03 Dawn (2).wav');
    expect(await files.get('03 Dawn.wav')?.text()).toBe('old');
  });

  it('resolves null when the user cancels the picker (deck-recording: "Folder picking cancelled")', async () => {
    expect(await directoryRecordingFolders(abort).choose()).toBeNull();
  });
});
