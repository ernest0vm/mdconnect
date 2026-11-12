import * as fs from 'node:fs/promises';
import { mkdtemp, readdir, readFile, rm, writeFile, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordingFolders } from './recordings';

vi.mock('electron', () => ({ dialog: {}, ipcMain: { handle: vi.fn() } }));
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof fs>();
  return { ...actual, open: vi.fn(actual.open) };
});

/** Makes the next file opened behave like `change` says, on top of a real file handle. */
function nextOpen(change: (handle: FileHandle) => Partial<FileHandle>) {
  const open = vi.mocked(fs.open);
  const real = open.getMockImplementation();
  if (real === undefined) throw new Error('open is not mocked');
  open.mockImplementationOnce(async (...args) => {
    const handle = await real(...args);
    return Object.assign(Object.create(handle) as FileHandle, change(handle));
  });
}

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mdconnect-recordings-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const bytes = (text: string) => new TextEncoder().encode(text);

function folders(picked: string | null = root) {
  let next = 0;
  return new RecordingFolders({
    pickFolder: () => Promise.resolve(picked),
    newId: () => `id-${String((next += 1))}`,
  });
}

/** Writes a whole file through create, append and finish, as the page does. */
async function writeAll(
  recordings: RecordingFolders,
  folderId: string,
  name: string,
  parts: string[],
) {
  const file = await recordings.create(folderId, name);
  for (const part of parts) await recordings.append(file.id, bytes(part));
  await recordings.finish(file.id);
  return file.name;
}

describe('RecordingFolders', () => {
  it('writes into the chosen folder in parts and reports the final name, not the path (desktop-shell: "Write into the chosen folder")', async () => {
    const recordings = folders();
    const folder = await recordings.choose();
    expect(folder).toEqual({ id: 'id-1', name: root.split(/[\\/]/u).at(-1) });
    expect(await writeAll(recordings, 'id-1', '03 Dawn.wav', ['RI', 'FF'])).toBe('03 Dawn.wav');
    expect(await readFile(join(root, '03 Dawn.wav'), 'utf8')).toBe('RIFF');
  });

  it('never overwrites a file: the new one gets a free name (deck-recording: "Name already taken")', async () => {
    await writeFile(join(root, '03 Dawn.wav'), 'old');
    const recordings = folders();
    await recordings.choose();
    expect(await writeAll(recordings, 'id-1', '03 Dawn.wav', ['new'])).toBe('03 Dawn (2).wav');
    expect(await readFile(join(root, '03 Dawn.wav'), 'utf8')).toBe('old');
  });

  it('removes a file that was discarded part-way, so no partial recording is left (desktop-shell: "Discarded file")', async () => {
    const recordings = folders();
    await recordings.choose();
    const file = await recordings.create('id-1', '03 Dawn.wav');
    await recordings.append(file.id, bytes('RIFF'));
    await recordings.discard(file.id);
    expect(await readdir(root)).toEqual([]);
  });

  it('writes every byte when the system writes only part of a batch', async () => {
    nextOpen((handle) => ({
      // Writes at most two bytes per call, as a busy disk may.
      write: ((data: Uint8Array, offset = 0, length = data.byteLength) =>
        handle.write(data, offset, Math.min(length, 2))) as FileHandle['write'],
    }));
    const recordings = folders();
    await recordings.choose();
    await writeAll(recordings, 'id-1', '01 One.wav', ['RIFF-data']);
    expect(await readFile(join(root, '01 One.wav'), 'utf8')).toBe('RIFF-data');
  });

  it('still removes a file whose close failed, when it is then discarded', async () => {
    let fail = true;
    nextOpen((handle) => ({
      close: () => {
        if (!fail) return handle.close();
        fail = false;
        return Promise.reject(new Error('EIO'));
      },
    }));
    const recordings = folders();
    await recordings.choose();
    const file = await recordings.create('id-1', '01 One.wav');
    await recordings.append(file.id, bytes('RIFF'));
    await expect(recordings.finish(file.id)).rejects.toThrow('EIO');
    await recordings.discard(file.id);
    expect(await readdir(root)).toEqual([]);
  });

  it("discards a page's open files when it goes away, such as a reload or a closed window", async () => {
    const recordings = folders();
    await recordings.choose();
    const first = await recordings.create('id-1', '01 One.wav', 7);
    await recordings.append(first.id, bytes('RIFF'));
    await writeAll(recordings, 'id-1', '02 Two.wav', ['done']);
    await recordings.create('id-1', '03 Three.wav', 7);
    const otherPage = await recordings.create('id-1', '04 Four.wav', 8);
    await recordings.discardOwnedBy(7);
    expect((await readdir(root)).sort()).toEqual(['02 Two.wav', '04 Four.wav']);
    await recordings.finish(otherPage.id);
    await expect(recordings.append(first.id, bytes('more'))).rejects.toThrow();
  });

  it('refuses a name with a path or a colon in it and creates nothing (desktop-shell: "Path in a file name")', async () => {
    const recordings = folders();
    await recordings.choose();
    await expect(recordings.create('id-1', '../evil.wav')).rejects.toThrow(/name/u);
    await expect(recordings.create('id-1', 'a/b.wav')).rejects.toThrow(/name/u);
    await expect(recordings.create('id-1', 'a:stream.wav')).rejects.toThrow(/name/u);
    expect(await readdir(root)).toEqual([]);
  });

  it('refuses a write with no folder picked or an unknown id (desktop-shell: "No folder picked")', async () => {
    const recordings = folders();
    await expect(recordings.create('id-1', 'a.wav')).rejects.toThrow(/folder/u);
    await recordings.choose();
    await expect(recordings.create('id-9', 'a.wav')).rejects.toThrow(/folder/u);
    await expect(recordings.append('id-9', bytes('x'))).rejects.toThrow(/file/u);
  });

  it('returns null when the dialog is cancelled (deck-recording: "Folder picking cancelled")', async () => {
    expect(await folders(null).choose()).toBeNull();
  });
});
