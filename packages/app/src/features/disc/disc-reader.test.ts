import {
  FRAMES_PER_SECOND,
  NetMdRejectedError,
  NetMdTimeoutError,
  type Disc,
} from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { DiscReader, type DiscSession } from './disc-reader';
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

function session(overrides: Partial<DiscSession> = {}): DiscSession {
  return {
    isDiscPresent: () => Promise.resolve(true),
    listContent: () => Promise.resolve(blank),
    run: () => Promise.resolve(),
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

  it('reports the device as unavailable, not Hi-MD mode, when the NetMD session cannot be opened (disc-contents: "Device in use")', async () => {
    const failingOpen = new DiscReader(() =>
      Promise.reject(new DOMException('claim', 'NetworkError')),
    );
    expect(await failingOpen.read()).toEqual({ kind: 'failed', reason: 'unavailable' });
  });

  it('reports Hi-MD mode for a Hi-MD-mode device ID without opening a session', async () => {
    let opened = false;
    const reader = new DiscReader(
      () => {
        opened = true;
        return Promise.resolve(session());
      },
      { hiMdMode: () => true },
    );
    expect(await reader.read()).toEqual({ kind: 'failed', reason: 'not-netmd' });
    expect(opened).toBe(false);
  });

  it('checks for Hi-MD mode again after opening fails, once the configuration is known', async () => {
    let configured = false;
    const reader = new DiscReader(
      () => {
        configured = true; // Opening selected the configuration, which shows mass storage.
        return Promise.reject(new DOMException('claim', 'SecurityError'));
      },
      { hiMdMode: () => configured },
    );
    expect(await reader.read()).toEqual({ kind: 'failed', reason: 'not-netmd' });
  });

  it('treats a timeout on the first query as a failed read with Retry, not as Hi-MD mode (disc-contents: "Command fails")', async () => {
    const silent = new DiscReader(() =>
      Promise.resolve(
        session({ isDiscPresent: () => Promise.reject(new NetMdTimeoutError('no reply')) }),
      ),
    );
    expect(await silent.read()).toEqual({ kind: 'failed', reason: 'read-failed' });
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

  it('shares the read in progress with a second request instead of reading twice', async () => {
    let reads = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reader = new DiscReader(() =>
      Promise.resolve(
        session({
          listContent: async () => {
            reads += 1;
            await gate;
            return blank;
          },
        }),
      ),
    );
    const first = reader.read();
    const second = reader.read();
    release();
    expect(await second).toEqual(await first);
    expect(reads).toBe(1);
    await reader.read();
    expect(reads).toBe(2);
  });

  it('reopens the NetMD session on Retry after a failed read, to drain stale replies', async () => {
    let opened = 0;
    let fail = true;
    const reader = new DiscReader(() => {
      opened += 1;
      return Promise.resolve(
        session({
          listContent: () =>
            fail ? Promise.reject(new Error('mismatch')) : Promise.resolve(blank),
        }),
      );
    });
    expect((await reader.read()).kind).toBe('failed');
    fail = false;
    expect((await reader.read()).kind).toBe('disc');
    expect(opened).toBe(2);
  });

  describe('edit', () => {
    const plan = renameTrackPlan(0, 'Intro');

    it('runs the plan, then reads the disc again (disc-contents: "Read again after an edit")', async () => {
      const log: string[] = [];
      const reader = new DiscReader(() =>
        Promise.resolve(
          session({
            run: (command) => {
              log.push(command.kind);
              return Promise.resolve();
            },
            listContent: () => {
              log.push('list');
              return Promise.resolve(blank);
            },
          }),
        ),
      );
      const { outcome, result } = await reader.edit(plan);
      expect(outcome).toEqual({ kind: 'saved' });
      expect(result.kind).toBe('disc');
      expect(log).toEqual(['setTrackTitle', 'list']);
    });

    it('reports a rejected edit and still reads the disc again (disc-editing: "Device rejects an edit")', async () => {
      let opened = 0;
      const reader = new DiscReader(() => {
        opened += 1;
        return Promise.resolve(
          session({ run: () => Promise.reject(new NetMdRejectedError('no')) }),
        );
      });
      const { outcome, result } = await reader.edit(plan);
      expect(outcome).toEqual({ kind: 'failed', reason: 'rejected' });
      expect(result.kind).toBe('disc');
      // The session is reopened before the read, to drain any reply the failed command left.
      expect(opened).toBe(2);
    });

    it('stops at the first failed command', async () => {
      const ran: string[] = [];
      const reader = new DiscReader(() =>
        Promise.resolve(
          session({
            run: (command) => {
              ran.push(command.kind);
              return Promise.reject(new NetMdTimeoutError('silent'));
            },
          }),
        ),
      );
      const { outcome } = await reader.edit(renameTrackPlan(0, 'A', 'エー'));
      expect(outcome).toEqual({ kind: 'failed', reason: 'failed' });
      expect(ran).toEqual(['setTrackTitle']);
    });

    it('waits for a read in progress before writing (disc-editing: "Edit in progress")', async () => {
      const log: string[] = [];
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let first = true;
      const reader = new DiscReader(() =>
        Promise.resolve(
          session({
            listContent: async () => {
              log.push('list');
              if (first) {
                first = false;
                await gate;
              }
              return blank;
            },
            run: () => {
              log.push('run');
              return Promise.resolve();
            },
          }),
        ),
      );
      const reading = reader.read();
      const editing = reader.edit(plan);
      release();
      await Promise.all([reading, editing]);
      expect(log).toEqual(['list', 'run', 'list']);
    });

    it('shares the edit with a Refresh requested meanwhile', async () => {
      let lists = 0;
      const reader = new DiscReader(() =>
        Promise.resolve(
          session({
            listContent: () => {
              lists += 1;
              return Promise.resolve(blank);
            },
          }),
        ),
      );
      const editing = reader.edit(plan);
      const refresh = reader.read();
      expect(await refresh).toEqual((await editing).result);
      expect(lists).toBe(1);
    });
  });
});

describe('DiscReader.edit failures', () => {
  const blankSession = (run: DiscSession['run']): DiscSession => ({
    isDiscPresent: () => Promise.resolve(true),
    listContent: () => Promise.resolve(blank),
    run,
  });

  it('runs the plan recovery for the commands that completed before a failure', async () => {
    const ran: string[] = [];
    const reader = new DiscReader(() =>
      Promise.resolve(
        blankSession((command) => {
          ran.push(command.kind === 'eraseTrack' ? `erase ${String(command.track)}` : command.kind);
          if (command.kind === 'eraseTrack' && command.track === 0) {
            return Promise.reject(new NetMdRejectedError('no'));
          }
          return Promise.resolve();
        }),
      ),
    );
    const plan = {
      commands: [
        { kind: 'eraseTrack', track: 1 },
        { kind: 'eraseTrack', track: 0 },
      ] as const,
      recovery: (completed: number) =>
        completed === 1 ? [{ kind: 'rewriteGroups', disc: blank } as const] : [],
    };
    const { outcome } = await reader.edit(plan);
    expect(outcome).toEqual({ kind: 'failed', reason: 'rejected' });
    expect(ran).toEqual(['erase 1', 'erase 0', 'rewriteGroups']);
  });

  it('reports a title the disc cannot store without blaming the device', async () => {
    const reader = new DiscReader(() =>
      Promise.resolve(blankSession(() => Promise.reject(new RangeError('"😀" cannot be encoded')))),
    );
    const { outcome } = await reader.edit(renameTrackPlan(0, '😀'));
    expect(outcome).toEqual({ kind: 'failed', reason: 'unsupported-title' });
  });
});
