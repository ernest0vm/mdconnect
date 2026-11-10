import { describe, expect, it } from 'vitest';

import { NetMdInterface } from './interface';
import { getDeviceStatus } from './status';
import { channel, noSleep } from './testing/scripted-channel';

const STATUS_QUERY = '00 1809 8001 0230 8800 0030 8804 00 ff00 00000000';
const PLAYBACK_QUERY = '00 1809 8001 0330 8802 0030 8805 0030 8806 00 ff00 00000000';
const POSITION_QUERY = '00 1809 8001 0430 8802 0030 8805 0030 0003 0030 0002 00 ff00 00000000';

/** Replies for a device whose status byte 4 is `disc`, operating status `operating`. */
function device(disc: string, operating: string, position: string | null) {
  const script: Record<string, string> = {
    [STATUS_QUERY]: `09 1809 8001 0230 8800 0030 8804 00 1000 00090000 0009 00000000${disc}00000000`,
    [PLAYBACK_QUERY]: `09 1809 8001 0330 8802 0030 8805 0030 8806 00 1000 00080000 0006 00000000${operating} 00`,
    [POSITION_QUERY]:
      position === null
        ? '0a 1809 8001 0430 8802 0030 8805 0030 0003 0030 0002 00 ff00 00000000'
        : `09 1809 8001 0430 8802 0030 8805 0030 0003 0030 0002 00 1000 000b0000 000b 0002 0007 00 ${position}`,
  };
  return new NetMdInterface(channel(script).ch, { sleep: noSleep });
}

describe('getDeviceStatus', () => {
  it('reports the track and time while playing (playback: "Playing")', async () => {
    // Track 3 (zero-based) at 0 h 1 min 23 s, frame 5, in BCD.
    expect(await getDeviceStatus(device('40', 'c375', '0003 00 01 23 05'))).toEqual({
      discPresent: true,
      state: 'playing',
      track: 3,
      time: { minute: 1, second: 23, frame: 5 },
    });
  });

  it('counts hours into minutes', async () => {
    const status = await getDeviceStatus(device('40', 'c37d', '0000 01 02 03 00'));
    expect(status.state).toBe('paused');
    expect(status.time).toEqual({ minute: 62, second: 3, frame: 0 });
  });

  it('reports a stopped device as ready (playback: "Stopped")', async () => {
    expect((await getDeviceStatus(device('40', 'c5ff', '0001 00 00 00 00'))).state).toBe('ready');
  });

  it('reports no disc, with no track, when the device rejects the position query', async () => {
    expect(await getDeviceStatus(device('80', 'ff10', null))).toEqual({
      discPresent: false,
      state: 'noDisc',
      track: null,
      time: null,
    });
  });

  it('does not count a disc as present while the device reads its table of contents', async () => {
    const status = await getDeviceStatus(device('40', 'ff23', null));
    expect(status).toMatchObject({ discPresent: false, state: 'readingTOC' });
  });

  it('reports an operating status it does not know as unknown', async () => {
    expect((await getDeviceStatus(device('40', '1234', null))).state).toBe('unknown');
  });
});
