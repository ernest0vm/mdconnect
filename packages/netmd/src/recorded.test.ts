import { describe, expect, it } from 'vitest';

import { rewriteDiscGroups } from './commands';
import { listContent, type Disc, type Track } from './content';
import { Encoding, NetMdInterface } from './interface';
import { NetMdTransport, type NetMdUsbDevice } from './transport';
import edits from './fixtures/mz-ne410-edits.json';
import grouped from './fixtures/mz-ne410-grouped-lp4.json';
import noDisc from './fixtures/mz-ne410-no-disc.json';
import refresh from './fixtures/mz-ne410-refresh-lp2.json';

interface Transfer {
  readonly dir: 'in' | 'out';
  readonly request: number;
  readonly data: string;
}

const fromHex = (hex: string) =>
  new Uint8Array((hex.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));
const toHex = (data: BufferSource) =>
  [...new Uint8Array(ArrayBuffer.isView(data) ? data.buffer : data)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Replays control transfers recorded from a real device, in order. Every command the code sends
 * must match the recorded one byte for byte; every read returns the recorded reply.
 */
function replay(transfers: readonly Transfer[]): NetMdUsbDevice & { remaining: () => number } {
  let next = 0;
  const take = (dir: Transfer['dir'], request: number): Transfer => {
    const transfer = transfers[next];
    next += 1;
    if (transfer?.dir !== dir || transfer.request !== request) {
      throw new Error(
        `Transfer ${String(next - 1)}: expected ${dir} ${String(request)}, recorded ${transfer?.dir ?? 'nothing'} ${String(transfer?.request)}`,
      );
    }
    return transfer;
  };
  return {
    opened: true,
    open: () => Promise.resolve(),
    selectConfiguration: () => Promise.resolve(),
    claimInterface: () => Promise.resolve(),
    controlTransferIn: (setup) => {
      const data = fromHex(take('in', setup.request).data);
      return Promise.resolve({ data: new DataView(data.buffer) });
    },
    controlTransferOut: (setup, data) => {
      const recorded = take('out', setup.request);
      expect(toHex(data)).toBe(recorded.data);
      return Promise.resolve({});
    },
    remaining: () => transfers.length - next,
  };
}

const LP4: number = Encoding.lp4;

describe('reading a recorded disc (MZ-NE410/NF520D, 60 LP4 tracks, titles anonymized)', () => {
  it('replays a full read byte for byte (disc-contents: "Disc read on connect", "Grouped disc", "Capacity")', async () => {
    const device = replay(grouped.transfers as Transfer[]);
    const transport = new NetMdTransport(device, { sleep: () => Promise.resolve() });
    await transport.init();
    const md = new NetMdInterface(transport, { sleep: () => Promise.resolve() });
    expect(await md.isDiscPresent()).toBe(true);
    const disc = await listContent(md);

    expect(device.remaining()).toBe(0);
    expect(disc.title).toBe("xxxxxx xx xx'x xxxx");
    expect(disc.trackCount).toBe(60);
    expect(disc.writeProtected).toBe(false);
    expect(disc.groups.map((g) => [g.title, g.tracks.length])).toEqual([
      [null, 50],
      ['xxxx', 2],
      ['xxxxxx', 8],
    ]);
    expect(disc.groups[1]?.tracks.map((t) => t.index)).toEqual([0, 1]);
    expect(disc.groups[2]?.tracks.map((t) => t.index)).toEqual([50, 51, 52, 53, 54, 55, 56, 57]);
    expect(disc.groups.flatMap((g) => g.tracks).every((t) => t.encoding === LP4)).toBe(true);
    // 80:59 total and 2:14 free on the device; used is reported as playback time (300:18).
    const secondsOf = (frames: number) => Math.floor(frames / 512);
    expect(secondsOf(disc.total)).toBe(80 * 60 + 59);
    expect(secondsOf(disc.left)).toBe(2 * 60 + 14);
    expect(secondsOf(disc.used)).toBe(300 * 60 + 18);
    // Track 1 is 5:43 on the device.
    expect(Math.floor((disc.groups[1]?.tracks[0]?.duration ?? 0) / 512)).toBe(5 * 60 + 43);
  });

  it('replays the status read of a device with no disc (disc-contents: "No disc inserted")', async () => {
    const device = replay(noDisc.transfers as Transfer[]);
    const transport = new NetMdTransport(device, { sleep: () => Promise.resolve() });
    await transport.init();
    const md = new NetMdInterface(transport, { sleep: () => Promise.resolve() });
    expect(await md.isDiscPresent()).toBe(false);
    expect(device.remaining()).toBe(0);
  });

  it('replays a Refresh on an open session after a disc was inserted (disc-contents: "Refresh after changing discs")', async () => {
    const device = replay(refresh.transfers as Transfer[]);
    // Refresh reuses the session opened for the earlier read, so there is no init here.
    const md = new NetMdInterface(new NetMdTransport(device, { sleep: () => Promise.resolve() }), {
      sleep: () => Promise.resolve(),
    });
    expect(await md.isDiscPresent()).toBe(true);
    const disc = await listContent(md);
    expect(device.remaining()).toBe(0);
    expect(disc.trackCount).toBe(37);
    expect(disc.groups).toHaveLength(1);
    expect(disc.groups[0]?.title).toBeNull();
    const LP2: number = Encoding.lp2;
    expect(disc.groups[0]?.tracks.every((t) => t.encoding === LP2)).toBe(true);
    const secondsOf = (frames: number) => Math.floor(frames / 512);
    expect(secondsOf(disc.total)).toBe(74 * 60 + 59);
    expect(secondsOf(disc.left)).toBe(2 * 60 + 25);
    // Track 14 is stored with a space where an accented letter was ("Te Llor  un Rio").
    expect(disc.groups[0]?.tracks[13]?.title).toBe('xx xxxx  xx xxx');
  });
});

describe('replaying recorded edits (MZ-NE410/NF520D, 37 LP2 tracks, titles anonymized)', () => {
  const noSleep = { sleep: () => Promise.resolve() };
  const session = (index: number) => {
    const edit = edits.edits[index];
    if (edit === undefined) throw new Error(`no recorded edit ${String(index)}`);
    const device = replay(edit.transfers as Transfer[]);
    return { device, md: new NetMdInterface(new NetMdTransport(device, noSleep), noSleep) };
  };
  const discTitle = "xxxxxxxx/xxxxxx.xxxxxxxx./xxxxxxx.xxxxx.-xxxx'x.xxxxxxxxx";
  const track = (index: number): Track => ({
    index,
    title: '',
    fullWidthTitle: '',
    duration: 0,
    channel: 0,
    encoding: Encoding.lp2,
    flags: 3,
  });
  const disc = (groups: Disc['groups']): Disc => ({
    title: discTitle,
    fullWidthTitle: '',
    writable: true,
    writeProtected: false,
    used: 0,
    left: 0,
    total: 0,
    trackCount: 37,
    groups,
  });
  const tracks = Array.from({ length: 37 }, (_, i) => track(i));

  it('renames a track byte for byte (disc-editing: "Rename a track")', async () => {
    const { device, md } = session(0);
    await md.setTrackTitle(13, 'xx xxxxx xx xxx');
    expect(device.remaining()).toBe(0);
  });

  it('moves a track and leaves unchanged disc titles alone (disc-editing: "Move with the keyboard")', async () => {
    const { device, md } = session(1);
    await md.moveTrack(15, 14);
    await rewriteDiscGroups(md, disc([{ title: null, fullWidthTitle: null, tracks }]));
    expect(device.remaining()).toBe(0);
  });

  it('writes a new group into the disc title (disc-editing: "Group tracks")', async () => {
    const { device, md } = session(2);
    await rewriteDiscGroups(
      md,
      disc([
        { title: null, fullWidthTitle: null, tracks: tracks.slice(2) },
        { title: 'xxxx xxxxx', fullWidthTitle: '', tracks: tracks.slice(0, 2) },
      ]),
    );
    expect(device.remaining()).toBe(0);
  });
});
