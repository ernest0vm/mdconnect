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
    newId: () => `folder-${String((next += 1))}`,
  });
}

describe('RecordingFolders', () => {
  it('writes into the chosen folder and reports the final name, not the path (desktop-shell: "Write into the chosen folder")', async () => {
    const recordings = folders();
    const folder = await recordings.choose();
    expect(folder).toEqual({ id: 'folder-1', name: root.split(/[\\/]/u).at(-1) });
    const saved = await recordings.write('folder-1', '03 Dawn.wav', bytes('RIFF'));
    expect(saved).toBe('03 Dawn.wav');
    expect(await readFile(join(root, '03 Dawn.wav'), 'utf8')).toBe('RIFF');
  });

  it('never overwrites a file: the new one gets a free name (deck-recording: "Name already taken")', async () => {
    await writeFile(join(root, '03 Dawn.wav'), 'old');
    const recordings = folders();
    await recordings.choose();
    expect(await recordings.write('folder-1', '03 Dawn.wav', bytes('new'))).toBe('03 Dawn (2).wav');
    expect(await readFile(join(root, '03 Dawn.wav'), 'utf8')).toBe('old');
  });

  it('refuses a name with a path in it and creates nothing (desktop-shell: "Path in a file name")', async () => {
    const recordings = folders();
    await recordings.choose();
    await expect(recordings.write('folder-1', '../evil.wav', bytes('x'))).rejects.toThrow(/name/u);
    await expect(recordings.write('folder-1', 'a/b.wav', bytes('x'))).rejects.toThrow(/name/u);
    expect(await readdir(root)).toEqual([]);
  });

  it('refuses a write with no folder picked or an unknown id (desktop-shell: "No folder picked")', async () => {
    const recordings = folders();
    await expect(recordings.write('folder-1', 'a.wav', bytes('x'))).rejects.toThrow(/folder/u);
    await recordings.choose();
    await expect(recordings.write('folder-9', 'a.wav', bytes('x'))).rejects.toThrow(/folder/u);
  });

  it('returns null when the dialog is cancelled (deck-recording: "Folder picking cancelled")', async () => {
    expect(await folders(null).choose()).toBeNull();
  });
});
