import { describe, expect, it } from 'vitest';

import { NetMdRejectedError } from './errors';
import { NetMdInterface } from './interface';
import { ascii, bytes, channel, key, noSleep, word } from './testing/scripted-channel';

const k = (hex: string) => key(bytes(hex));

/** Reply to a half-width disc title read, in one chunk. */
function discTitleReply(raw: string, fullWidth = false) {
  const data = ascii(raw);
  const length = data.length / 2;
  return {
    [`00 1806 02201801 000${fullWidth ? '1' : '0'} 3000 0a00 ff00 0000 0000`]: `09 1806 02201801 000${fullWidth ? '1' : '0'} 3000 0a00 1000 ${word(length + 6)} 0000 0000 000a ${word(length)} ${data}`,
  };
}

function trackTitleReply(track: number, title: string) {
  const data = ascii(title);
  return {
    [`00 1806 022018 02 ${word(track)} 3000 0a00 ff00 00000000`]: `09 1806 022018 02 ${word(track)} 3000 0a00 1000 0000 0000 0000 000a ${word(data.length / 2)} ${data}`,
  };
}

const writeAccepted = (command: string) => ({
  [command]: `09${k(command).slice(2, 2 + 2 * 20)}`,
});

describe('setTrackTitle', () => {
  const write = '00 1807 022018 02 0002 3000 0a00 5000 0005 0000 0003 496e74726f';

  it('writes the new half-width title with the old and new lengths (disc-editing: "Rename a track")', async () => {
    const { ch, sent } = channel({ ...trackTitleReply(2, 'Old'), ...writeAccepted(write) });
    await new NetMdInterface(ch, { sleep: noSleep }).setTrackTitle(2, 'Intro');
    expect(sent.slice(-3)).toEqual([
      k('00 1808 10 1802 03 00'),
      k(write),
      k('00 1808 10 1802 00 00'),
    ]);
  });

  it('writes a full-width title through the full-width descriptor', async () => {
    const fullWrite = '00 1807 022018 03 0000 3000 0a00 5000 0006 0000 0000 96e996be82af';
    const { ch, sent } = channel({
      '00 1806 022018 03 0000 3000 0a00 ff00 00000000': '0a',
      ...writeAccepted(fullWrite),
    });
    await new NetMdInterface(ch, { sleep: noSleep }).setTrackTitle(0, '夜明け', true);
    expect(sent.slice(-3)).toEqual([
      k('00 1808 10 1803 03 00'),
      k(fullWrite),
      k('00 1808 10 1803 00 00'),
    ]);
  });

  it('skips the write when the title is unchanged', async () => {
    const { ch, sent } = channel(trackTitleReply(2, 'Intro'));
    await new NetMdInterface(ch, { sleep: noSleep }).setTrackTitle(2, 'Intro');
    expect(sent.some((c) => c.startsWith('001807'))).toBe(false);
  });

  it('fails when the device rejects the write (disc-editing: "Device rejects an edit")', async () => {
    const { ch } = channel({ ...trackTitleReply(2, 'Old'), [write]: '0a' });
    await expect(
      new NetMdInterface(ch, { sleep: noSleep }).setTrackTitle(2, 'Intro'),
    ).rejects.toThrow(NetMdRejectedError);
  });
});

describe('setDiscTitle', () => {
  const write = '00 1807 02201801 0000 3000 0a00 5000 0007 0000 0003 303b4d69782f2f';

  it('writes the raw disc title and reopens the title descriptor', async () => {
    const { ch, sent } = channel({ ...discTitleReply('Old'), ...writeAccepted(write) });
    await new NetMdInterface(ch, { sleep: noSleep }).setDiscTitle('0;Mix//');
    expect(sent.slice(-6)).toEqual([
      k('00 1808 10 1801 00 00'),
      k('00 1808 10 1801 03 00'),
      k(write),
      k('00 1808 10 1801 00 00'),
      k('00 1808 10 1801 01 00'),
      k('00 1808 10 1801 00 00'),
    ]);
  });

  it('writes through the track title descriptor on Sharp devices', async () => {
    const { ch, sent } = channel({ ...discTitleReply('Old'), ...writeAccepted(write) });
    await new NetMdInterface(ch, { sleep: noSleep, vendorId: 0x04dd }).setDiscTitle('0;Mix//');
    expect(sent.slice(-3)).toEqual([
      k('00 1808 10 1802 03 00'),
      k(write),
      k('00 1808 10 1802 00 00'),
    ]);
  });

  it('skips the write when the title is unchanged', async () => {
    const { ch, sent } = channel(discTitleReply('0;Mix//'));
    await new NetMdInterface(ch, { sleep: noSleep }).setDiscTitle('0;Mix//');
    expect(sent.some((c) => c.startsWith('001807'))).toBe(false);
  });
});

describe('eraseTrack and moveTrack', () => {
  it('erases a track by its zero-based index', async () => {
    const erase = '00 1840 ff01 00 201001 0003';
    const { ch, sent } = channel({ [erase]: '09 1840 0001 00 201001 0003' });
    await new NetMdInterface(ch, { sleep: noSleep }).eraseTrack(3);
    expect(sent).toEqual([k(erase)]);
  });

  it('moves a track to a new zero-based position', async () => {
    const move = '00 1843 ff00 00 201001 0004 201001 0001';
    const { ch, sent } = channel({ [move]: '09 1843 0000 00 201001 0004 201001 0001' });
    await new NetMdInterface(ch, { sleep: noSleep }).moveTrack(4, 1);
    expect(sent).toEqual([k(move)]);
  });

  it('fails when the device rejects an erase', async () => {
    const { ch } = channel({ '00 1840 ff01 00 201001 0000': '0a' });
    await expect(new NetMdInterface(ch, { sleep: noSleep }).eraseTrack(0)).rejects.toThrow(
      NetMdRejectedError,
    );
  });
});

describe('titles stored with bytes the decoder cannot read', () => {
  it('measures the old title in stored bytes, so a broken title can be replaced', async () => {
    // "A" followed by 0xff, which Shift-JIS cannot decode: two stored bytes.
    const write = '00 1807 022018 02 0000 3000 0a00 5000 0001 0000 0002 42';
    const { ch, sent } = channel({
      '00 1806 022018 02 0000 3000 0a00 ff00 00000000':
        '09 1806 022018 02 0000 3000 0a00 1000 0000 0000 0000 000a 0002 41ff',
      ...writeAccepted(write),
    });
    await new NetMdInterface(ch, { sleep: noSleep }).setTrackTitle(0, 'B');
    expect(sent).toContain(k(write));
  });
});
