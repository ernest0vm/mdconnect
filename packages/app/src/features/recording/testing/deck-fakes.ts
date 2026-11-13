import type { DeviceStatus } from '@mdconnect/netmd';

import type { PlaybackCommand } from '../../disc/disc-reader';
import type { LiveCapture } from '../capture-source';
import type { RecordingDeck } from '../session';

export const RATE = 100; // 100 frames a second keeps the fake audio small.

/** A deck that records the commands it gets and reports the track it is on, at 0:00. */
export function fakeDeck(options: { refuse?: PlaybackCommand['kind'] } = {}) {
  const commands: string[] = [];
  let track = 0;
  let state: DeviceStatus['state'] = 'ready';
  const status = (): DeviceStatus => ({
    discPresent: true,
    state,
    track,
    time: { minute: 0, second: 1, frame: 0 },
  });
  const deck: RecordingDeck = {
    control(command) {
      commands.push(command.kind === 'goto' ? `goto ${String(command.track)}` : command.kind);
      if (command.kind === options.refuse) return Promise.resolve({ ok: false });
      if (command.kind === 'goto') track = command.track;
      if (command.kind === 'play') state = 'playing';
      if (command.kind === 'pause') state = 'paused';
      if (command.kind === 'stop') state = 'ready';
      return Promise.resolve({ ok: true });
    },
    status: () => Promise.resolve(status()),
  };
  return { deck, commands };
}

/** A capture that delivers 50-frame blocks whenever someone listens, as an input would. */
export function fakeCapture() {
  let closed = false;
  const capture: LiveCapture = {
    channels: 2,
    sampleRate: RATE,
    onBlock(listener) {
      let listening = true;
      const tick = () => {
        if (!listening) return;
        listener([new Float32Array(50).fill(0.2), new Float32Array(50).fill(-0.2)]);
        setTimeout(tick, 0);
      };
      setTimeout(tick, 0);
      return () => {
        listening = false;
      };
    },
    onEnded: () => () => undefined,
    close() {
      closed = true;
      return Promise.resolve();
    },
  };
  return { capture, isClosed: () => closed };
}
