import type { DeviceStatus } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { StatusPoller, type PollClock, type Visibility } from './status-poller';

const status = (track: number): DeviceStatus => ({
  discPresent: true,
  state: 'playing',
  track,
  time: null,
});

function clock() {
  let tick: (() => void) | null = null;
  const fake: PollClock = {
    every: (_ms, fn) => {
      tick = fn;
      return () => {
        tick = null;
      };
    },
  };
  return {
    fake,
    tick: () => {
      tick?.();
    },
    running: () => tick !== null,
  };
}

function visibility(initial = true) {
  let visible = initial;
  const listeners = new Set<() => void>();
  const fake: Visibility = {
    visible: () => visible,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    fake,
    set: (next: boolean) => {
      visible = next;
      for (const listener of listeners) listener();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StatusPoller (playback: "Playback advances", "Hidden window")', () => {
  it('reads the status on each tick and reports it', async () => {
    const c = clock();
    const seen: (number | null)[] = [];
    let track = 0;
    const poller = new StatusPoller(
      () => Promise.resolve(status(track++)),
      (s) => seen.push(s?.track ?? null),
      c.fake,
      visibility().fake,
    );
    poller.start();
    c.tick();
    await flush();
    c.tick();
    await flush();
    expect(seen).toEqual([0, 1]);
    poller.stop();
  });

  it('skips a tick while the previous read is still running', async () => {
    const c = clock();
    let reads = 0;
    let release: () => void = () => undefined;
    const poller = new StatusPoller(
      () => {
        reads += 1;
        return new Promise<DeviceStatus>((resolve) => {
          release = () => {
            resolve(status(0));
          };
        });
      },
      () => undefined,
      c.fake,
      visibility().fake,
    );
    poller.start();
    c.tick();
    c.tick();
    expect(reads).toBe(1);
    release();
    await flush();
    c.tick();
    expect(reads).toBe(2);
    poller.stop();
  });

  it('stops while the window is hidden and resumes when it is shown', () => {
    const c = clock();
    const v = visibility();
    const poller = new StatusPoller(
      () => Promise.resolve(null),
      () => undefined,
      c.fake,
      v.fake,
    );
    poller.start();
    expect(c.running()).toBe(true);
    v.set(false);
    expect(c.running()).toBe(false);
    v.set(true);
    expect(c.running()).toBe(true);
    poller.stop();
    expect(c.running()).toBe(false);
  });

  it('does not start while hidden', () => {
    const c = clock();
    const poller = new StatusPoller(
      () => Promise.resolve(null),
      () => undefined,
      c.fake,
      visibility(false).fake,
    );
    poller.start();
    expect(c.running()).toBe(false);
    poller.stop();
  });

  it('ignores a read that finishes after it was stopped', async () => {
    const c = clock();
    const seen: unknown[] = [];
    let release: () => void = () => undefined;
    const poller = new StatusPoller(
      () =>
        new Promise<DeviceStatus>((resolve) => {
          release = () => {
            resolve(status(1));
          };
        }),
      (s) => seen.push(s),
      c.fake,
      visibility().fake,
    );
    poller.start();
    c.tick();
    poller.stop();
    release();
    await flush();
    expect(seen).toEqual([]);
  });

  it('reports only changes, and keeps the last status when a read fails', async () => {
    const c = clock();
    const seen: (number | null)[] = [];
    const reads = [status(1), status(1), null, status(2)];
    const poller = new StatusPoller(
      () => Promise.resolve(reads.shift() ?? null),
      (s) => seen.push(s?.track ?? null),
      c.fake,
      visibility().fake,
    );
    poller.start();
    for (let i = 0; i < 4; i++) {
      c.tick();
      await flush();
    }
    expect(seen).toEqual([1, 2]);
    poller.stop();
  });

  it('reports a device without status once, not every second', async () => {
    const c = clock();
    let reports = 0;
    const poller = new StatusPoller(
      () => Promise.resolve(null),
      () => {
        reports += 1;
      },
      c.fake,
      visibility().fake,
    );
    poller.start();
    for (let i = 0; i < 3; i++) {
      c.tick();
      await flush();
    }
    expect(reports).toBe(1);
    poller.stop();
  });
});
