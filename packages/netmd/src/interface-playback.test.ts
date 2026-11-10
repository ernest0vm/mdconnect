import { describe, expect, it } from 'vitest';

import { NetMdTimeoutError } from './errors';
import { NetMdInterface } from './interface';
import { bytes, channel, key, noSleep } from './testing/scripted-channel';

const k = (hex: string) => key(bytes(hex));
const md = (script: Record<string, string>) => {
  const { ch, sent } = channel(script);
  return { md: new NetMdInterface(ch, { sleep: noSleep }), sent };
};

describe('playback commands (playback: "Play", "Pause", "Stop", "Next track")', () => {
  it('plays and pauses with the play action byte', async () => {
    const { md: play, sent } = md({
      '00 18c3 ff 75 000000': '09 18c3 00 75 000000',
      '00 18c3 ff 7d 000000': '09 18c3 00 7d 000000',
    });
    await play.play();
    await play.pause();
    expect(sent).toEqual([k('00 18c3 ff 75 000000'), k('00 18c3 ff 7d 000000')]);
  });

  it('stops, and ignores a device that rejects stop (upstream LAM-1 fix)', async () => {
    const { md: ok, sent } = md({ '00 18c5 ff 00000000': '09 18c5 00 00000000' });
    await ok.stop();
    expect(sent).toEqual([k('00 18c5 ff 00000000')]);
    const { md: rejecting } = md({ '00 18c5 ff 00000000': '0a 18c5 ff 00000000' });
    await expect(rejecting.stop()).resolves.toBeUndefined();
  });

  it('passes on a stop that times out, which is not a rejection', async () => {
    const ch = {
      sendCommand: () => Promise.resolve(),
      readReply: () => Promise.reject(new NetMdTimeoutError('silent')),
    };
    await expect(new NetMdInterface(ch, { sleep: noSleep }).stop()).rejects.toThrow(
      NetMdTimeoutError,
    );
  });

  it('moves to the next and previous track', async () => {
    const { md: m, sent } = md({
      '00 1850 ff10 00000000 8001': '09 1850 0010 00000000 8001',
      '00 1850 ff10 00000000 0002': '09 1850 0010 00000000 0002',
    });
    await m.nextTrack();
    await m.previousTrack();
    expect(sent).toEqual([k('00 1850 ff10 00000000 8001'), k('00 1850 ff10 00000000 0002')]);
  });

  it('goes to a zero-based track and returns the track the device reports', async () => {
    const { md: m } = md({ '00 1850 ff010000 0000 0005': '09 1850 00010000 0000 0005' });
    expect(await m.gotoTrack(5)).toBe(5);
  });
});
