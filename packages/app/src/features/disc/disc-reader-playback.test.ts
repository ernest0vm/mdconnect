import {
  FRAMES_PER_SECOND,
  NetMdRejectedError,
  NetMdTimeoutError,
  type DeviceStatus,
  type Disc,
} from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { DiscReader, type DiscSession, type PlaybackCommand } from './disc-reader';
import { renameTrackPlan } from './edit-plan';

const blank: Disc = {
  title: '',
  fullWidthTitle: '',
  writable: true,
  writeProtected: false,
  used: 0,
  left: 80 * 60 * FRAMES_PER_SECOND,
  total: 80 * 60 * FRAMES_PER_SECOND,
  trackCount: 0,
  groups: [],
};

const playing = (track: number): DeviceStatus => ({
  discPresent: true,
  state: 'playing',
  track,
  time: { minute: 0, second: 5, frame: 0 },
});

/** A session that records playback commands and answers status reads from `statuses`. */
function fake(
  options: { reject?: (command: PlaybackCommand) => Error | null; status?: DeviceStatus } = {},
) {
  const sent: string[] = [];
  const log: string[] = [];
  let current = options.status ?? playing(2);
  const session: DiscSession = {
    isDiscPresent: () => Promise.resolve(true),
    listContent: () => {
      log.push('list');
      return Promise.resolve(blank);
    },
    run: (command) => {
      log.push(command.kind);
      return Promise.resolve();
    },
    playback: (command) => {
      sent.push(
        command.kind === 'goto' || command.kind === 'playTrack'
          ? `${command.kind} ${String(command.track)}`
          : command.kind,
      );
      const error = options.reject?.(command) ?? null;
      if (error) return Promise.reject(error);
      if (command.kind === 'goto') current = { ...current, track: command.track };
      if (command.kind === 'next' && current.track !== null) current = playing(current.track + 1);
      return Promise.resolve();
    },
    deviceStatus: () => {
      log.push('status');
      return Promise.resolve(current);
    },
  };
  const reader = new DiscReader(() => Promise.resolve(session), { sleep: () => Promise.resolve() });
  return { reader, sent, log };
}

describe('DiscReader.control', () => {
  it('sends the command and returns the status read after it (playback: "Play", "Pause", "Stop")', async () => {
    const { reader, sent, log } = fake();
    const result = await reader.control({ kind: 'pause' }, { track: 2, trackCount: 10 });
    expect(sent).toEqual(['pause']);
    expect(log).toEqual(['status']);
    expect(result).toEqual({ outcome: { kind: 'done' }, status: playing(2) });
  });

  it('moves to the next track (playback: "Next track")', async () => {
    const { reader, sent } = fake();
    const { status } = await reader.control({ kind: 'next' }, { track: 2, trackCount: 10 });
    expect(sent).toEqual(['next']);
    expect(status?.track).toBe(3);
  });

  it('falls back to stop, goto and play when the device rejects next (playback: "Device without next and previous")', async () => {
    const { reader, sent } = fake({
      reject: (c) => (c.kind === 'next' ? new NetMdRejectedError('no') : null),
    });
    const { outcome } = await reader.control({ kind: 'next' }, { track: 2, trackCount: 10 });
    expect(sent).toEqual(['next', 'stop', 'goto 3', 'play']);
    expect(outcome).toEqual({ kind: 'done' });
  });

  it('plays a chosen track in one queued step (playback: "Play a chosen track")', async () => {
    const { reader, sent } = fake();
    await reader.control({ kind: 'playTrack', track: 6 }, { track: 1, trackCount: 10 });
    expect(sent).toEqual(['playTrack 6']);
  });

  it('sends nothing for next on the last track or previous on the first (playback: "Last track")', async () => {
    const { reader, sent } = fake();
    await reader.control({ kind: 'next' }, { track: 9, trackCount: 10 });
    await reader.control({ kind: 'previous' }, { track: 0, trackCount: 10 });
    expect(sent).toEqual([]);
  });

  it('reports a rejected command without a raw error (playback: "Device rejects a control")', async () => {
    const { reader, log } = fake({ reject: () => new NetMdRejectedError('no') });
    const { outcome, status } = await reader.control(
      { kind: 'play' },
      { track: 2, trackCount: 10 },
    );
    expect(outcome).toEqual({ kind: 'failed', reason: 'rejected' });
    // The status is read again, so the player shows what the device is doing.
    expect(status).not.toBeNull();
    expect(log).toEqual(['status']);
  });

  it('reports a command that times out as failed', async () => {
    const { reader } = fake({ reject: () => new NetMdTimeoutError('silent') });
    const { outcome } = await reader.control({ kind: 'stop' }, { track: 2, trackCount: 10 });
    expect(outcome).toEqual({ kind: 'failed', reason: 'failed' });
  });
});

describe('DiscReader.status', () => {
  it('waits for an edit and the read after it (playback: "Status during an edit")', async () => {
    const { reader, log } = fake();
    const edit = reader.edit(renameTrackPlan(0, 'x'));
    const status = reader.status();
    await Promise.all([edit, status]);
    expect(log).toEqual(['setTrackTitle', 'list', 'status']);
  });

  it('shares a status read in progress', async () => {
    const { reader, log } = fake();
    const [a, b] = await Promise.all([reader.status(), reader.status()]);
    expect(a).toEqual(b);
    expect(log).toEqual(['status']);
  });

  it('returns null when the status cannot be read', async () => {
    const reader = new DiscReader(() => Promise.reject(new Error('busy')));
    expect(await reader.status()).toBeNull();
  });

  it('keeps the session when the device refuses the status queries', async () => {
    let opened = 0;
    const reader = new DiscReader(() => {
      opened += 1;
      return Promise.resolve({
        isDiscPresent: () => Promise.resolve(true),
        listContent: () => Promise.resolve(blank),
        run: () => Promise.resolve(),
        playback: () => Promise.resolve(),
        deviceStatus: () => Promise.reject(new NetMdRejectedError('no')),
      });
    });
    expect(await reader.status()).toBeNull();
    expect(await reader.status()).toBeNull();
    expect(opened).toBe(1);
  });

  it('does not open a NetMD session on a device in Hi-MD mode', async () => {
    let opened = 0;
    const reader = new DiscReader(
      () => {
        opened += 1;
        return Promise.reject(new Error('not used'));
      },
      { hiMdMode: () => true, sleep: () => Promise.resolve() },
    );
    expect(await reader.status()).toBeNull();
    expect((await reader.control({ kind: 'play' }, { track: 0, trackCount: 1 })).outcome).toEqual({
      kind: 'failed',
      reason: 'failed',
    });
    expect(opened).toBe(0);
  });
});
