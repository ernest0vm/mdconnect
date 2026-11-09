import { describe, expect, it } from 'vitest';

import { listContent } from './content';
import { Encoding, NetMdInterface } from './interface';
import { NetMdTransport, type NetMdUsbDevice } from './transport';
import grouped from './fixtures/mz-ne410-grouped-lp4.json';

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
});
