import type { Song } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

import { InputLostError } from '../recording/capture';
import type { LiveCapture } from '../recording/capture-source';
import type { RecordingTrack } from '../recording/session';
import { fakeCapture, fakeDeck, RATE } from '../recording/testing/deck-fakes';
import type { PcmBuffer } from '../recording/wav';
import {
  acoustIdPlan,
  identifyTracks,
  shazamPlan,
  type Identifier,
  type IdentifyOptions,
} from './identify-session';
import { ServiceUnreachableError } from './retry';

const dawn: Song = { title: 'Dawn', artist: 'Eleni Karaindrou', album: null, year: null };

const track = (index: number, title: string, seconds: number): RecordingTrack => ({
  index,
  title,
  fullWidthTitle: '',
  seconds,
});

/** An identifier that answers from a list, one answer per excerpt, and records what it heard. */
function scripted(answers: readonly (Song | null | Error)[], plan = shazamPlan) {
  const heard: number[] = [];
  let next = 0;
  const identifier: Identifier = {
    plan,
    identify(pcm: PcmBuffer) {
      heard.push(pcm.frames);
      const answer = answers[next++] ?? null;
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  return { identifier, heard };
}

function options(
  identifier: Identifier,
  overrides: Partial<IdentifyOptions> = {},
): IdentifyOptions {
  return {
    deck: fakeDeck().deck,
    capture: fakeCapture().capture,
    identifier,
    sleep: () => Promise.resolve(),
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('shazamPlan and acoustIdPlan', () => {
  it('take 12-second excerpts that fit in the track, at most three (song-recognition: "Excerpts stay within the track")', () => {
    expect(shazamPlan(200)).toEqual({ excerptSeconds: 12, attempts: 3 });
    expect(shazamPlan(20)).toEqual({ excerptSeconds: 12, attempts: 1 });
    expect(shazamPlan(30)).toEqual({ excerptSeconds: 12, attempts: 2 });
    expect(shazamPlan(9)).toBe('too-short');
  });

  it('listen to two minutes, or a shorter track whole (song-recognition: "Short track listened to whole")', () => {
    expect(acoustIdPlan(300)).toEqual({ excerptSeconds: 120, attempts: 1 });
    expect(acoustIdPlan(90)).toEqual({ excerptSeconds: 90, attempts: 1 });
    expect(acoustIdPlan(9)).toBe('too-short');
  });
});

describe('identifyTracks', () => {
  it('stops listening to a track once the first excerpt is found (song-recognition: "Found on the first excerpt", "Deck stopped at the end")', async () => {
    const { deck, commands } = fakeDeck();
    const { identifier, heard } = scripted([dawn, dawn]);
    const outcome = await identifyTracks(
      [track(1, 'Two', 60), track(4, 'Five', 60)],
      options(identifier, { deck }),
    );
    expect(outcome).toEqual({
      results: [
        { kind: 'found', song: dawn },
        { kind: 'found', song: dawn },
      ],
      ending: 'done',
    });
    expect(heard).toEqual([12 * RATE, 12 * RATE]);
    expect(commands.at(-1)).toBe('stop');
    expect(commands.filter((command) => command === 'play')).toHaveLength(4);
  });

  it('keeps playing into the next excerpt while it asks (song-recognition: "Found on a later excerpt")', async () => {
    const { deck, commands } = fakeDeck();
    const { identifier, heard } = scripted([null, dawn]);
    const outcome = await identifyTracks([track(2, 'Three', 60)], options(identifier, { deck }));
    expect(outcome.results).toEqual([{ kind: 'found', song: dawn }]);
    expect(heard).toEqual([12 * RATE, 12 * RATE]);
    // Primed once (play, pause), then played once for both excerpts.
    expect(commands).toEqual(['stop', 'goto 2', 'play', 'pause', 'goto 2', 'play', 'stop']);
  });

  it('takes no excerpt past the track’s end (song-recognition: "Excerpts stay within the track")', async () => {
    const { identifier, heard } = scripted([null, dawn]);
    const outcome = await identifyTracks([track(0, 'One', 20)], options(identifier));
    expect(outcome.results).toEqual([{ kind: 'not-found' }]);
    expect(heard).toEqual([12 * RATE]);
  });

  it('marks a track not recognised after three excerpts (song-recognition: "Not found")', async () => {
    const { identifier, heard } = scripted([null, null, null]);
    const outcome = await identifyTracks([track(0, 'One', 60)], options(identifier));
    expect(outcome.results).toEqual([{ kind: 'not-found' }]);
    expect(heard).toHaveLength(3);
  });

  it('does not play a track too short to identify (song-recognition: "Too short")', async () => {
    const { deck, commands } = fakeDeck();
    for (const plan of [shazamPlan, acoustIdPlan]) {
      const { identifier, heard } = scripted([dawn], plan);
      const outcome = await identifyTracks([track(6, 'Seven', 9)], options(identifier, { deck }));
      expect(outcome.results).toEqual([{ kind: 'too-short' }]);
      expect(heard).toEqual([]);
    }
    expect(commands).not.toContain('goto 6');
  });

  it('listens to a short track whole with AcoustID (song-recognition: "Short track listened to whole")', async () => {
    const { identifier, heard } = scripted([dawn], acoustIdPlan);
    await identifyTracks([track(0, 'One', 90)], options(identifier));
    expect(heard).toEqual([90 * RATE]);
  });

  it('marks a track whose service cannot be reached and goes on (song-recognition: "Service down")', async () => {
    const { identifier } = scripted([new ServiceUnreachableError(), dawn]);
    const outcome = await identifyTracks(
      [track(0, 'One', 60), track(1, 'Two', 60)],
      options(identifier),
    );
    expect(outcome.results).toEqual([{ kind: 'unreachable' }, { kind: 'found', song: dawn }]);
  });

  it('reports progress: the track out of how many and whether it listens or asks (song-recognition: "Progress")', async () => {
    const stages: string[] = [];
    const { identifier } = scripted([dawn, dawn]);
    await identifyTracks(
      [track(0, 'One', 60), track(1, 'Two', 60)],
      options(identifier, {
        onProgress: ({ position, total, title, stage }) => {
          stages.push(`${String(position + 1)}/${String(total)} ${title} ${stage}`);
        },
      }),
    );
    expect([...new Set(stages)]).toEqual([
      '1/2 One listening',
      '1/2 One asking',
      '2/2 Two listening',
      '2/2 Two asking',
    ]);
  });

  it('stops at once on Cancel and keeps the results found so far (song-recognition: "Cancel")', async () => {
    const { deck, commands } = fakeDeck();
    const cancel = new AbortController();
    let calls = 0;
    const identifier: Identifier = {
      plan: shazamPlan,
      identify: () => {
        calls += 1;
        if (calls === 2) cancel.abort();
        return Promise.resolve(calls === 1 ? dawn : null);
      },
    };
    const outcome = await identifyTracks(
      [track(0, 'One', 60), track(1, 'Two', 60), track(2, 'Three', 60)],
      options(identifier, { deck, signal: cancel.signal }),
    );
    expect(outcome).toEqual({
      results: [{ kind: 'found', song: dawn }, { kind: 'none' }, { kind: 'none' }],
      ending: 'cancelled',
    });
    expect(commands.at(-1)).toBe('stop');
  });

  it('does not wait for a Shazam call that never answers when cancelled, and ignores its late reply', async () => {
    const { deck, commands } = fakeDeck();
    const cancel = new AbortController();
    let reply: (song: Song) => void = () => undefined;
    const identifier: Identifier = {
      plan: shazamPlan,
      identify: () =>
        new Promise((resolve) => {
          reply = resolve;
          cancel.abort();
        }),
    };
    const outcome = await identifyTracks(
      [track(0, 'One', 60)],
      options(identifier, { deck, signal: cancel.signal }),
    );
    expect(outcome).toEqual({ results: [{ kind: 'none' }], ending: 'cancelled' });
    expect(commands.at(-1)).toBe('stop');
    reply(dawn);
    await Promise.resolve();
    expect(outcome.results).toEqual([{ kind: 'none' }]);
  });

  it('says the device was disconnected (song-recognition: "Deck unplugged")', async () => {
    const unplug = new AbortController();
    const identifier: Identifier = {
      plan: shazamPlan,
      identify: () => {
        unplug.abort('disconnected');
        return Promise.resolve(null);
      },
    };
    const outcome = await identifyTracks(
      [track(0, 'One', 60)],
      options(identifier, { signal: unplug.signal }),
    );
    expect(outcome.ending).toBe('disconnected');
  });

  it('stops when the input stops', async () => {
    const { capture } = fakeCapture();
    const lost: LiveCapture = {
      ...capture,
      onEnded: (listener) => {
        queueMicrotask(listener);
        return () => undefined;
      },
    };
    const { identifier } = scripted([dawn]);
    const outcome = await identifyTracks(
      [track(0, 'One', 60)],
      options(identifier, { capture: lost }),
    );
    expect(outcome.ending).toBe('input-lost');
    expect(new InputLostError()).toBeInstanceOf(Error);
  });

  it('stops when the input stops while it waits for an answer', async () => {
    const { capture } = fakeCapture();
    const listeners = new Set<() => void>();
    const ended = () => {
      for (const listener of listeners) listener();
    };
    const lost: LiveCapture = {
      ...capture,
      onEnded: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const identifier: Identifier = {
      plan: shazamPlan,
      // The service never answers; the input stops meanwhile.
      identify: () => {
        setTimeout(() => {
          ended();
        }, 0);
        return new Promise(() => undefined);
      },
    };
    const { deck, commands } = fakeDeck();
    const outcome = await identifyTracks(
      [track(0, 'One', 60)],
      options(identifier, { capture: lost, deck }),
    );
    expect(outcome.ending).toBe('input-lost');
    expect(commands.at(-1)).toBe('stop');
  });

  it('leaves no listen pending when the deck refuses to play', async () => {
    const { capture } = fakeCapture();
    const silent: LiveCapture = {
      ...capture,
      onBlock: () => () => undefined,
      onEnded: (listener) => {
        setTimeout(listener, 0);
        return () => undefined;
      },
    };
    const { deck } = fakeDeck({ refuse: 'play' });
    const { identifier } = scripted([dawn]);
    const outcome = await identifyTracks(
      [track(0, 'One', 60)],
      options(identifier, { capture: silent, deck }),
    );
    expect(outcome.ending).toBe('refused');
    // An input that ends afterwards must not leave an unhandled rejection behind.
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  it('ends as refused when the deck refuses a command', async () => {
    const { deck } = fakeDeck({ refuse: 'play' });
    const { identifier } = scripted([dawn]);
    const outcome = await identifyTracks([track(0, 'One', 60)], options(identifier, { deck }));
    expect(outcome.ending).toBe('refused');
  });
});
