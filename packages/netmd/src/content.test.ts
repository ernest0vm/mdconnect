import { describe, expect, it } from 'vitest';

import { listContent, timeToFrames } from './content';
import { NetMdNotImplementedError, NetMdRejectedError } from './errors';
import { Encoding, NetMdInterface, type CommandChannel } from './interface';
import { ascii, bytes, channel, key, noSleep, word } from './testing/scripted-channel';

/** Replies for a disc titled `raw` (half-width only), with `tracks` [title, h, m, s, encoding, channel]. */
function discScript(
  raw: string,
  tracks: [string, number, number, number, number, number][],
  options: { flags?: number; used?: number[]; total?: number[]; left?: number[] } = {},
) {
  const titleBytes = ascii(raw);
  const titleLength = titleBytes.length / 2;
  const bcd = (n: number) => n.toString().padStart(2, '0');
  const time = (t: number[]) =>
    `0005 ${bcd(t[0] ?? 0).padStart(4, '0')} ${bcd(t[1] ?? 0)} ${bcd(t[2] ?? 0)} ${bcd(t[3] ?? 0)}`;
  const script: Record<string, string> = {
    '00 1806 01101000 ff00 0001000b': `09 1806 01101000 1000 0001000b ${(options.flags ?? 0x10).toString(16).padStart(2, '0')}`,
    '00 1806 02101000 3080 0300 ff00 00000000': `09 1806 02101000 3080 0300 1000 001d0000 001b 8003 0017 8000 ${time(options.used ?? [0, 30, 0, 0])} ${time(options.total ?? [0, 80, 0, 0])} ${time(options.left ?? [0, 50, 0, 0])}`,
    '00 1806 02101001 3000 1000 ff00 00000000': `09 1806 02101001 3000 1000 1000 0000 0000 0006 0010000200 ${tracks.length.toString(16).padStart(2, '0')}`,
    // Half-width disc title, one chunk; full-width title empty.
    '00 1806 02201801 0000 3000 0a00 ff00 0000 0000': `09 1806 02201801 0000 3000 0a00 1000 ${word(titleLength + 6)} 0000 0000 000a ${word(titleLength)} ${titleBytes}`,
    '00 1806 02201801 0001 3000 0a00 ff00 0000 0000': `09 1806 02201801 0001 3000 0a00 1000 0006 0000 0000 000a 0000`,
  };
  tracks.forEach(([title, h, m, s, encoding, channelValue], i) => {
    const t = ascii(title);
    script[`00 1806 02201802 ${word(i)} 3000 0a00 ff00 00000000`] =
      `09 1806 02201802 ${word(i)} 3000 0a00 1000 0000 0000 0000 000a ${word(t.length / 2)} ${t}`;
    script[`00 1806 02201803 ${word(i)} 3000 0a00 ff00 00000000`] =
      `09 1806 02201803 ${word(i)} 3000 0a00 1000 0000 0000 0000 000a 0000`;
    script[`00 1806 02201001 ${word(i)} 3000 0100 ff00 00000000`] =
      `09 1806 02201001 ${word(i)} 3000 0100 1000 0000 0000 000a 0001 0006 0000 ${bcd(h)} ${bcd(m)} ${bcd(s)} 00`;
    script[`00 1806 02201001 ${word(i)} 3080 0700 ff00 00000000`] =
      `09 1806 02201001 ${word(i)} 3080 0700 1000 0000 0000 0008 8007 0004 0110 ${encoding.toString(16)} ${channelValue.toString(16).padStart(2, '0')}`;
    script[`00 1806 01201001 ${word(i)} ff00 00010008`] =
      `09 1806 01201001 ${word(i)} 10 00 00010008 00`;
  });
  return script;
}

describe('NetMdInterface.sendQuery', () => {
  it('prefixes the control status and strips the reply status', async () => {
    const { ch, sent } = channel({
      '00 1806 01101000 ff00 0001000b': '09 1806 01101000 1000 0001000b 40',
    });
    expect(await new NetMdInterface(ch, { sleep: noSleep }).getDiscFlags()).toBe(0x40);
    expect(sent).toContain(key(bytes('00 1806 01101000 ff00 0001000b')));
  });

  it('turns "not implemented" and "rejected" replies into errors (disc-contents: "Command fails")', async () => {
    const notImpl = channel({ '00 1806 01101000 ff00 0001000b': '08 1806' });
    await expect(
      new NetMdInterface(notImpl.ch, { sleep: noSleep }).getDiscFlags(),
    ).rejects.toBeInstanceOf(NetMdNotImplementedError);
    const rejected = channel({ '00 1806 01101000 ff00 0001000b': '0a 1806' });
    await expect(
      new NetMdInterface(rejected.ch, { sleep: noSleep }).getDiscFlags(),
    ).rejects.toBeInstanceOf(NetMdRejectedError);
  });

  it('accepts other non-error statuses, as upstream does (for example "changed")', async () => {
    const { ch } = channel({
      '00 1806 01101000 ff00 0001000b': '0d 1806 01101000 1000 0001000b 10',
    });
    expect(await new NetMdInterface(ch, { sleep: noSleep }).getDiscFlags()).toBe(0x10);
  });

  it('ignores a rejected descriptor command, as some devices reject them', async () => {
    const { ch } = channel({
      '00 1808 10 1000 01 00': '0a 1808',
      '00 1806 01101000 ff00 0001000b': '09 1806 01101000 1000 0001000b 10',
    });
    expect(await new NetMdInterface(ch, { sleep: noSleep }).getDiscFlags()).toBe(0x10);
  });

  it('lets a transport error on a descriptor command through, for example an unplugged device', async () => {
    let last = '';
    const ch: CommandChannel = {
      sendCommand: (command) => {
        last = key(command);
        return Promise.resolve();
      },
      readReply: () =>
        last.startsWith('001808')
          ? Promise.reject(new DOMException('gone', 'NotFoundError'))
          : Promise.resolve(bytes('09 1806 01101000 1000 0001000b 10')),
    };
    await expect(new NetMdInterface(ch, { sleep: noSleep }).getDiscFlags()).rejects.toThrow('gone');
  });

  it('retries "interim" replies and gives up after four', async () => {
    const { ch } = channel({ '00 1806 01101000 ff00 0001000b': '0f 1806' });
    await expect(new NetMdInterface(ch, { sleep: noSleep }).getDiscFlags()).rejects.toThrow(
      /interim/i,
    );
  });
});

describe('timeToFrames', () => {
  it('counts 512 frames per second', () => {
    expect(timeToFrames([0, 1, 2, 3])).toBe(62 * 512 + 3);
    expect(timeToFrames([1, 0, 0, 0])).toBe(3600 * 512);
  });
});

describe('listContent (disc-contents: "Disc read on connect", "Grouped disc", "Capacity", "Blank disc")', () => {
  it('reads a grouped disc: title, groups, tracks, durations, encodings and capacity', async () => {
    const { ch } = channel(
      discScript('0;My Disc//1-2;Side A//', [
        ['First', 0, 3, 25, Encoding.sp, 0],
        ['Second', 0, 4, 0, Encoding.lp2, 0],
        ['', 0, 1, 30, Encoding.sp, 1],
      ]),
    );
    const disc = await listContent(new NetMdInterface(ch, { sleep: noSleep }));
    expect(disc.title).toBe('My Disc');
    expect(disc.trackCount).toBe(3);
    expect(disc.writable).toBe(true);
    expect(disc.writeProtected).toBe(false);
    expect([disc.used, disc.total, disc.left]).toEqual([
      30 * 60 * 512,
      80 * 60 * 512,
      50 * 60 * 512,
    ]);
    expect(
      disc.groups.map((g) => [
        g.title,
        g.tracks.map((t) => [t.index, t.title, t.duration, t.encoding, t.channel]),
      ]),
    ).toEqual([
      [null, [[2, '', 90 * 512, Encoding.sp, 1]]],
      [
        'Side A',
        [
          [0, 'First', 205 * 512, Encoding.sp, 0],
          [1, 'Second', 240 * 512, Encoding.lp2, 0],
        ],
      ],
    ]);
  });

  it('reads write protection from the disc flags (disc-contents: "Write-protected disc")', async () => {
    const { ch } = channel(discScript('Disc', [], { flags: 0x40 }));
    const disc = await listContent(new NetMdInterface(ch, { sleep: noSleep }));
    expect(disc.writeProtected).toBe(true);
  });

  it('reads a blank disc as no tracks and its whole capacity free', async () => {
    const { ch } = channel(discScript('', [], { used: [0, 0, 0, 0], left: [0, 80, 0, 0] }));
    const disc = await listContent(new NetMdInterface(ch, { sleep: noSleep }));
    expect(disc.groups).toEqual([]);
    expect(disc.left).toBe(disc.total);
  });

  it('halves capacities a device reports in LP terms (above 82 minutes)', async () => {
    const { ch } = channel(
      discScript('', [], { used: [0, 0, 0, 0], total: [2, 40, 0, 0], left: [2, 40, 0, 0] }),
    );
    const disc = await listContent(new NetMdInterface(ch, { sleep: noSleep }));
    expect(disc.total).toBe(80 * 60 * 512);
  });
});

describe('isDiscPresent (disc-contents: "No disc inserted")', () => {
  const status = (byte4: string) => ({
    '00 1809 8001 0230 8800 0030 8804 00 ff00 00000000': `09 1809 8001 0230 8800 0030 8804 00 1000 00090000 0006 00000000 ${byte4} 00`,
  });

  it('is true when the operating status reports a disc', async () => {
    const { ch } = channel(status('40'));
    expect(await new NetMdInterface(ch, { sleep: noSleep }).isDiscPresent()).toBe(true);
  });

  it('is false otherwise', async () => {
    const { ch } = channel(status('80'));
    expect(await new NetMdInterface(ch, { sleep: noSleep }).isDiscPresent()).toBe(false);
  });
});
