import { describe, expect, it } from 'vitest';

import type { RecordingFolder } from '../../platform';
import type { LiveCapture } from './capture-source';
import { recordTracks, type RecordingDeck, type RecordingTrack } from './session';
import { fakeCapture, fakeDeck } from './testing/deck-fakes';

function fakeFolder() {
  const files = new Map<string, Blob>();
  const folder: RecordingFolder = {
    name: 'MiniDisc',
    write: (name, parts) => {
      files.set(name, new Blob(parts as Uint8Array<ArrayBuffer>[]));
      return Promise.resolve(name);
    },
  };
  return { files, folder };
}

const track = (index: number, title: string, seconds: number): RecordingTrack => ({
  index,
  title,
  fullWidthTitle: '',
  seconds,
});

const noSleep = () => Promise.resolve();

describe('recordTracks', () => {
  it('primes, rewinds, captures and plays each track, then stops the deck (deck-recording: "Several tracks", "Deck stopped at the end")', async () => {
    const { deck, commands } = fakeDeck();
    const { capture, isClosed } = fakeCapture();
    const { folder, files } = fakeFolder();
    const summary = await recordTracks([track(1, 'Two', 2), track(4, 'Five', 1)], {
      deck,
      capture,
      trackCount: 12,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(commands).toEqual([
      'stop',
      'goto 1',
      'play',
      'pause',
      'goto 1',
      'play',
      'goto 4',
      'play',
      'pause',
      'goto 4',
      'play',
      'stop',
    ]);
    expect([...files.keys()]).toEqual(['02 Two.wav', '05 Five.wav']);
    expect(summary).toEqual({
      saved: ['02 Two.wav', '05 Five.wav'],
      folder: 'MiniDisc',
      clipped: [],
      ending: 'done',
    });
    expect(isClosed()).toBe(true);
  });

  it('records the track length plus a 1.5-second margin (deck-recording: "One track")', async () => {
    const { deck } = fakeDeck();
    const { capture } = fakeCapture();
    const { folder, files } = fakeFolder();
    await recordTracks([track(0, 'One', 2)], {
      deck,
      capture,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    const file = files.get('01 One.wav');
    if (file === undefined) throw new Error('no file saved');
    const wav = new Uint8Array(await file.arrayBuffer());
    const dataBytes = new DataView(wav.buffer).getUint32(40, true);
    // 3.5 s at 100 frames a second, stereo, 16-bit, rounded up to whole 50-frame blocks.
    expect(dataBytes).toBe(350 * 2 * 2);
  });

  it('downloads each file when there is no folder', async () => {
    const { deck } = fakeDeck();
    const { capture } = fakeCapture();
    const downloads: string[] = [];
    const summary = await recordTracks([track(0, 'One', 1)], {
      deck,
      capture,
      trackCount: 1,
      save: { kind: 'download', download: (name) => downloads.push(name) },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(downloads).toEqual(['01 One.wav']);
    expect(summary.folder).toBeNull();
  });

  it('stops at once on cancel, keeps earlier files and drops the track in progress (deck-recording: "Cancel")', async () => {
    const { deck, commands } = fakeDeck();
    const { capture } = fakeCapture();
    const { folder, files } = fakeFolder();
    const controller = new AbortController();
    const summary = await recordTracks(
      [track(0, 'One', 0.5), track(1, 'Two', 60), track(2, 'Three', 1)],
      {
        deck,
        capture,
        trackCount: 3,
        save: { kind: 'folder', folder },
        sleep: noSleep,
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.position === 1 && progress.share > 0.1) controller.abort('cancelled');
        },
      },
    );
    expect([...files.keys()]).toEqual(['01 One.wav']);
    expect(summary.ending).toBe('cancelled');
    expect(commands.at(-1)).toBe('stop');
    expect(commands).not.toContain('goto 2');
  });

  it('reports a disconnected device and keeps earlier files (deck-recording: "Unplugged")', async () => {
    const { deck } = fakeDeck();
    const { capture } = fakeCapture();
    const { folder, files } = fakeFolder();
    const controller = new AbortController();
    const summary = await recordTracks([track(0, 'One', 0.5), track(1, 'Two', 60)], {
      deck,
      capture,
      trackCount: 2,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.position === 1 && progress.share > 0.1) controller.abort('disconnected');
      },
    });
    expect([...files.keys()]).toEqual(['01 One.wav']);
    expect(summary.ending).toBe('disconnected');
  });

  it('stops when the deck refuses a command, and says so', async () => {
    const { deck } = fakeDeck({ refuse: 'play' });
    const { capture } = fakeCapture();
    const { folder, files } = fakeFolder();
    const summary = await recordTracks([track(0, 'One', 1)], {
      deck,
      capture,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(summary.ending).toBe('refused');
    expect(files.size).toBe(0);
  });

  it('lists the tracks whose audio clipped', async () => {
    const { deck } = fakeDeck();
    const loud: LiveCapture = {
      ...fakeCapture().capture,
      onBlock(listener) {
        const id = setInterval(() => {
          listener([new Float32Array(50).fill(1.2), new Float32Array(50).fill(0)]);
        }, 0);
        return () => {
          clearInterval(id);
        };
      },
    };
    const { folder } = fakeFolder();
    const summary = await recordTracks([track(0, 'Loud', 1)], {
      deck,
      capture: loud,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(summary.clipped).toEqual(['01 Loud.wav']);
  });

  it('reports a failed save and keeps the files already saved, instead of failing silently', async () => {
    const { deck } = fakeDeck();
    const { capture, isClosed } = fakeCapture();
    let writes = 0;
    const folder: RecordingFolder = {
      name: 'MiniDisc',
      write: (name) => {
        writes += 1;
        return writes === 1 ? Promise.resolve(name) : Promise.reject(new Error('disk full'));
      },
    };
    const summary = await recordTracks([track(0, 'One', 0.5), track(1, 'Two', 0.5)], {
      deck,
      capture,
      trackCount: 2,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(summary).toMatchObject({ saved: ['01 One.wav'], ending: 'save-failed' });
    expect(isClosed()).toBe(true);
  });

  it('reports an unplug as disconnected even when a deck command fails at the same time', async () => {
    const controller = new AbortController();
    const { deck } = fakeDeck();
    const unplugging: RecordingDeck = {
      ...deck,
      control: (command) => {
        if (command.kind === 'goto') {
          controller.abort('disconnected');
          return Promise.resolve({ ok: false });
        }
        return deck.control(command);
      },
    };
    const { folder } = fakeFolder();
    const summary = await recordTracks([track(0, 'One', 1)], {
      deck: unplugging,
      capture: fakeCapture().capture,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: controller.signal,
    });
    expect(summary.ending).toBe('disconnected');
  });

  it('cancels a file being written, and reports the recording as cancelled', async () => {
    const controller = new AbortController();
    let signalGiven: AbortSignal | undefined;
    const folder: RecordingFolder = {
      name: 'MiniDisc',
      write: (_name, _parts, signal) => {
        signalGiven = signal;
        controller.abort('cancelled');
        return Promise.reject(new DOMException('cancelled', 'AbortError'));
      },
    };
    const summary = await recordTracks([track(0, 'One', 0.5)], {
      deck: fakeDeck().deck,
      capture: fakeCapture().capture,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: controller.signal,
    });
    expect(signalGiven).toBe(controller.signal);
    expect(summary).toMatchObject({ saved: [], ending: 'cancelled' });
  });

  it('still reports how the recording ended when closing the input fails', async () => {
    const { capture } = fakeCapture();
    const { folder } = fakeFolder();
    const summary = await recordTracks([track(0, 'One', 0.5)], {
      deck: fakeDeck().deck,
      capture: { ...capture, close: () => Promise.reject(new Error('already closed')) },
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(summary).toMatchObject({ saved: ['01 One.wav'], ending: 'done' });
  });

  it('reports a lost input and keeps earlier files (deck-recording: "Input lost")', async () => {
    const { capture } = fakeCapture();
    let ended: (() => void) | undefined;
    const { folder, files } = fakeFolder();
    const summary = await recordTracks([track(0, 'One', 0.5), track(1, 'Two', 60)], {
      deck: fakeDeck().deck,
      capture: {
        ...capture,
        onEnded: (listener) => {
          ended = listener;
          return () => undefined;
        },
      },
      trackCount: 2,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
      onProgress: (progress) => {
        if (progress.position === 1 && progress.share > 0.01) ended?.();
      },
    });
    expect([...files.keys()]).toEqual(['01 One.wav']);
    expect(summary.ending).toBe('input-lost');
  });

  it('reports a deck that stops answering as a failure, not as a save problem', async () => {
    const { deck } = fakeDeck();
    const { folder } = fakeFolder();
    const summary = await recordTracks([track(0, 'One', 0.5)], {
      deck: { ...deck, status: () => Promise.reject(new Error('USB transfer failed')) },
      capture: fakeCapture().capture,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: new AbortController().signal,
    });
    expect(summary.ending).toBe('failed');
  });

  it('keeps a file finished as Cancel was pressed, and reports the recording as cancelled (deck-recording: "Cancelled as a file completes")', async () => {
    const controller = new AbortController();
    const folder: RecordingFolder = {
      name: 'MiniDisc',
      write: (name) => {
        controller.abort('cancelled');
        return Promise.resolve(name);
      },
    };
    const summary = await recordTracks([track(0, 'One', 0.5)], {
      deck: fakeDeck().deck,
      capture: fakeCapture().capture,
      trackCount: 1,
      save: { kind: 'folder', folder },
      sleep: noSleep,
      signal: controller.signal,
    });
    expect(summary).toMatchObject({ saved: ['01 One.wav'], ending: 'cancelled' });
  });
});
