import { FRAMES_PER_SECOND, NetMdTimeoutError, type Disc } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { DiscReader, type DiscSession } from './disc-reader';

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

function session(overrides: Partial<DiscSession> = {}): DiscSession {
  return {
    isDiscPresent: () => Promise.resolve(true),
    listContent: () => Promise.resolve(blank),
    ...overrides,
  };
}

describe('DiscReader', () => {
  it('reads the disc into a view (disc-contents: "Disc read on connect")', async () => {
    const result = await new DiscReader(() => Promise.resolve(session())).read();
    expect(result.kind).toBe('disc');
    expect(result.kind === 'disc' && result.disc.capacity.free).toBe('80:00');
  });

  it('reports no disc without listing (disc-contents: "No disc inserted")', async () => {
    let listed = false;
    const reader = new DiscReader(() =>
      Promise.resolve(
        session({
          isDiscPresent: () => Promise.resolve(false),
          listContent: () => {
            listed = true;
            return Promise.resolve(blank);
          },
        }),
      ),
    );
    expect(await reader.read()).toEqual({ kind: 'no-disc' });
    expect(listed).toBe(false);
  });

  it('reports a device that does not answer NetMD when opening or the first query fails (disc-contents: "Device in Hi-MD mode")', async () => {
    const failingOpen = new DiscReader(() =>
      Promise.reject(new DOMException('claim', 'NetworkError')),
    );
    expect(await failingOpen.read()).toEqual({ kind: 'failed', reason: 'not-netmd' });
    const silent = new DiscReader(() =>
      Promise.resolve(
        session({ isDiscPresent: () => Promise.reject(new NetMdTimeoutError('no reply')) }),
      ),
    );
    expect(await silent.read()).toEqual({ kind: 'failed', reason: 'not-netmd' });
  });

  it('reports a failed read when listing fails (disc-contents: "Command fails")', async () => {
    const reader = new DiscReader(() =>
      Promise.resolve(session({ listContent: () => Promise.reject(new Error('rejected')) })),
    );
    expect(await reader.read()).toEqual({ kind: 'failed', reason: 'read-failed' });
  });

  it('opens the NetMD session once and reuses it for Refresh (disc-contents: "Refresh after changing discs")', async () => {
    let opened = 0;
    const reader = new DiscReader(() => {
      opened += 1;
      return Promise.resolve(session());
    });
    await reader.read();
    await reader.read();
    expect(opened).toBe(1);
  });

  it('retries opening the session after it failed', async () => {
    let attempts = 0;
    const reader = new DiscReader(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('busy')) : Promise.resolve(session());
    });
    expect((await reader.read()).kind).toBe('failed');
    expect((await reader.read()).kind).toBe('disc');
  });

  it('runs a Refresh after the read in progress, never alongside it', async () => {
    const log: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let call = 0;
    const reader = new DiscReader(() =>
      Promise.resolve(
        session({
          listContent: async () => {
            call += 1;
            const n = call;
            log.push(`start ${String(n)}`);
            if (n === 1) await gate;
            log.push(`end ${String(n)}`);
            return blank;
          },
        }),
      ),
    );
    const first = reader.read();
    const second = reader.read();
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });
});
