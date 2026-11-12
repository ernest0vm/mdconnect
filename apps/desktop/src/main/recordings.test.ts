import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordingFolders } from './recordings';

vi.mock('electron', () => ({ dialog: {}, ipcMain: { handle: vi.fn() } }));

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
