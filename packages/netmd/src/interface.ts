/*
 * Ported from netmd-js 4.4.1, src/netmd-interface.ts (class NetMDInterface) and
 * src/netmd-shared-objects.ts (Status), https://github.com/cybercase/netmd-js,
 * by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Only the queries needed to read a disc are ported. Changes from upstream:
 * - Native `BigInt` results from `scanQuery` are converted with `Number`.
 * - Track info is kept as bytes instead of a char-code string.
 * - No logging.
 * - `parseGroups` (titles.ts) skips malformed or overlapping group entries instead of failing.
 * - Descriptor errors other than "rejected" or "not implemented" are passed on; upstream ignores all.
 * - The title writers do not sanitise: callers pass titles already converted (see sanitize.ts), and
 *   the lengths are computed from the exact bytes sent. Upstream measured the title before
 *   sanitising it, so the two could differ.
 * - `eraseTrack` and `moveTrack` fail on a rejected reply like every other command.
 */

import { NetMdNotImplementedError, NetMdRejectedError } from './errors';
import { formatQuery, scanQuery, type ScannedValue } from './query';
import { encodeSjis, sjisLength } from './sjis';
import { decodeSjis } from './titles';

/** Sends one framed command and reads the device's reply. */
export interface CommandChannel {
  sendCommand(command: Uint8Array<ArrayBuffer>): Promise<void>;
  readReply(): Promise<Uint8Array>;
}

enum Status {
  control = 0x00,
  notImplemented = 0x08,
  rejected = 0x0a,
  interim = 0x0f,
}

export enum Encoding {
  sp = 0x90,
  lp2 = 0x92,
  lp4 = 0x93,
}

export enum Channels {
  stereo = 0x00,
  mono = 0x01,
}

/** Track protection: tracks transferred with SonicStage (OpenMG) are protected. */
export enum TrackFlag {
  unprotected = 0x00,
  protected = 0x03,
}

export enum DiscFlag {
  writable = 0x10,
  writeProtected = 0x40,
}

const Descriptor = {
  discTitleTD: '10 1801',
  audioUTOC1TD: '10 1802',
  audioUTOC4TD: '10 1803',
  audioContentsTD: '10 1001',
  rootTD: '10 1000',
  operatingStatusBlock: '80 00',
} as const;
type Descriptor = (typeof Descriptor)[keyof typeof Descriptor];

const OPEN_READ = '01';
const OPEN_WRITE = '03';
const CLOSE = '00';
const MAX_INTERIM_ATTEMPTS = 4;
const INTERIM_RETRY_MS = 100;

/** Hours, minutes, seconds and frames, as the device reports a time. */
export type DeviceTime = readonly [number, number, number, number];

export interface InterfaceOptions {
  readonly sleep?: (ms: number) => Promise<void>;
  /** The device's USB vendor ID; Sharp devices (0x04dd) write the disc title differently. */
  readonly vendorId?: number;
}

const SHARP_VENDOR_ID = 0x04dd;

const num = (value: ScannedValue | undefined): number =>
  typeof value === 'bigint' || typeof value === 'number' ? Number(value) : 0;
const buf = (value: ScannedValue | undefined): Uint8Array =>
  value instanceof Uint8Array ? value : new Uint8Array();

/** The NetMD command layer: status handling, descriptors and the read queries. */
export class NetMdInterface {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly vendorId: number | undefined;

  constructor(
    private readonly channel: CommandChannel,
    options: InterfaceOptions = {},
  ) {
    this.vendorId = options.vendorId;
    this.sleep =
      options.sleep ??
      ((ms) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
  }

  /** Sends a query with the "control" status byte and returns the reply without its status. */
  async sendQuery(query: Uint8Array): Promise<Uint8Array> {
    await this.channel.sendCommand(new Uint8Array([Status.control, ...query]));
    for (let attempt = 0; attempt < MAX_INTERIM_ATTEMPTS; attempt++) {
      const reply = await this.channel.readReply();
      const status = reply[0];
      if (status === Status.notImplemented) throw new NetMdNotImplementedError('Not implemented');
      if (status === Status.rejected) throw new NetMdRejectedError('Rejected');
      if (status === Status.interim) {
        await this.sleep(INTERIM_RETRY_MS * (2 ** attempt - 1));
        continue;
      }
      // Upstream's unknown-status check never fires (`indexOf(status) < -1`), so any other status,
      // such as accepted, implemented or changed, is treated as a reply.
      return reply.slice(1);
    }
    throw new NetMdRejectedError('Max read attempts for interim status reached');
  }

  /**
   * Opens or closes a descriptor. Like upstream, a device that rejects it or does not implement it
   * is ignored; any other error, such as a timeout or an unplugged device, is passed on.
   */
  private async descriptor(descriptor: Descriptor, action: string): Promise<void> {
    try {
      await this.sendQuery(formatQuery(`1808 ${descriptor} ${action} 00`));
    } catch (error) {
      if (error instanceof NetMdRejectedError || error instanceof NetMdNotImplementedError) return;
      throw error;
    }
  }

  private async withDescriptor<T>(descriptor: Descriptor, read: () => Promise<T>): Promise<T> {
    await this.descriptor(descriptor, OPEN_READ);
    const result = await read();
    await this.descriptor(descriptor, CLOSE);
    return result;
  }

  async getStatus(): Promise<Uint8Array> {
    return this.withDescriptor(Descriptor.operatingStatusBlock, async () => {
      const reply = await this.sendQuery(
        formatQuery('1809 8001 0230 8800 0030 8804 00 ff00 00000000'),
      );
      return buf(scanQuery(reply, '1809 8001 0230 8800 0030 8804 00 1000 00090000 %x')[0]);
    });
  }

  async isDiscPresent(): Promise<boolean> {
    return (await this.getStatus())[4] === 0x40;
  }

  async getDiscFlags(): Promise<number> {
    return this.withDescriptor(Descriptor.rootTD, async () => {
      const reply = await this.sendQuery(formatQuery('1806 01101000 ff00 0001000b'));
      return num(scanQuery(reply, '1806 01101000 1000 0001000b %b')[0]);
    });
  }

  async getTrackCount(): Promise<number> {
    return this.withDescriptor(Descriptor.audioContentsTD, async () => {
      const reply = await this.sendQuery(formatQuery('1806 02101001 3000 1000 ff00 00000000'));
      return num(scanQuery(reply, '1806 02101001 %?%? %?%? 1000 00%?0000 0006 0010000200%b')[0]);
    });
  }

  /** The disc title field as stored, including any group entries (`0;Title//1-3;Group//`). */
  async getRawDiscTitle(fullWidth = false): Promise<string> {
    await this.descriptor(Descriptor.audioContentsTD, OPEN_READ);
    await this.descriptor(Descriptor.discTitleTD, OPEN_READ);
    const chunks: Uint8Array[] = [];
    let done = 0;
    let total = 1;
    let remaining = 0;
    while (done < total) {
      const reply = await this.sendQuery(
        formatQuery('1806 02201801 00%b 3000 0a00 ff00 %w%w', fullWidth ? 1 : 0, remaining, done),
      );
      let chunkSize: number;
      if (remaining === 0) {
        const [size, all, data] = scanQuery(
          reply,
          '1806 02201801 00%? 3000 0a00 1000 %w0000 %?%?000a %w %*',
        );
        chunkSize = num(size) - 6;
        total = num(all);
        chunks.push(buf(data));
      } else {
        const [size, data] = scanQuery(reply, '1806 02201801 00%? 3000 0a00 1000 %w%?%? %*');
        chunkSize = num(size);
        chunks.push(buf(data));
      }
      if (chunkSize <= 0 && total > done) throw new NetMdRejectedError('Empty title chunk');
      done += chunkSize;
      remaining = total - done;
    }
    await this.descriptor(Descriptor.discTitleTD, CLOSE);
    await this.descriptor(Descriptor.audioContentsTD, CLOSE);
    const joined = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    return decodeSjis(joined);
  }

  async getTrackTitle(track: number, fullWidth = false): Promise<string> {
    const descriptor = fullWidth ? Descriptor.audioUTOC4TD : Descriptor.audioUTOC1TD;
    return this.withDescriptor(descriptor, async () => {
      const reply = await this.sendQuery(
        formatQuery('1806 022018%b %w 3000 0a00 ff00 00000000', fullWidth ? 3 : 2, track),
      );
      return decodeSjis(
        buf(scanQuery(reply, '1806 022018%? %?%? %?%? %?%? 1000 00%?0000 00%?000a %x')[0]),
      );
    });
  }

  private async getTrackInfo(track: number, p1: number, p2: number): Promise<Uint8Array> {
    return this.withDescriptor(Descriptor.audioContentsTD, async () => {
      const reply = await this.sendQuery(
        formatQuery('1806 02201001 %w %w %w ff00 00000000', track, p1, p2),
      );
      return buf(scanQuery(reply, '1806 02201001 %?%? %?%? %?%? 1000 00%?0000 %x')[0]);
    });
  }

  async getTrackLength(track: number): Promise<DeviceTime> {
    const info = await this.getTrackInfo(track, 0x3000, 0x0100);
    const [h, m, s, f] = scanQuery(info, '0001 0006 0000 %B %B %B %B').map(num);
    return [h ?? 0, m ?? 0, s ?? 0, f ?? 0];
  }

  /** The track's codec (`Encoding`) and channel mode (`Channels`). */
  async getTrackEncoding(track: number): Promise<{ codec: number; channel: number }> {
    const info = await this.getTrackInfo(track, 0x3080, 0x0700);
    const [codec, channel] = scanQuery(info, '8007 0004 0110 %b %b').map(num);
    return { codec: codec ?? 0, channel: channel ?? 0 };
  }

  async getTrackFlags(track: number): Promise<number> {
    return this.withDescriptor(Descriptor.audioContentsTD, async () => {
      const reply = await this.sendQuery(formatQuery('1806 01201001 %w ff00 00010008', track));
      return num(scanQuery(reply, '1806 01201001 %?%? 10 00 00010008 %b')[0]);
    });
  }

  /** Used, total and left recording time. */
  async getDiscCapacity(): Promise<[DeviceTime, DeviceTime, DeviceTime]> {
    return this.withDescriptor(Descriptor.rootTD, async () => {
      const reply = await this.sendQuery(formatQuery('1806 02101000 3080 0300 ff00 00000000'));
      // `%?03`: Panasonic devices reply 0803 where Sony replies 8003 (upstream note).
      const values = scanQuery(
        reply,
        '1806 02101000 3080 0300 1000 001d0000 001b %?03 0017 8000 0005 %W %B %B %B 0005 %W %B %B %B 0005 %W %B %B %B',
      ).map(num);
      const time = (i: number): DeviceTime => [
        values[i] ?? 0,
        values[i + 1] ?? 0,
        values[i + 2] ?? 0,
        values[i + 3] ?? 0,
      ];
      return [time(0), time(4), time(8)];
    });
  }

  /**
   * Writes the raw disc title field, groups included (`0;Title//1-3;Group//`). Writing the same
   * title again is skipped: it causes problems on some devices.
   */
  async setDiscTitle(title: string, fullWidth = false): Promise<void> {
    const current = await this.getRawDiscTitle(fullWidth);
    if (current === title) return;
    const sharp = this.vendorId === SHARP_VENDOR_ID;
    if (sharp) {
      // Sharp devices rename the disc through the track title descriptor (webminidisc issue #67).
      await this.descriptor(Descriptor.audioUTOC1TD, OPEN_WRITE);
    } else {
      await this.descriptor(Descriptor.discTitleTD, CLOSE);
      await this.descriptor(Descriptor.discTitleTD, OPEN_WRITE);
    }
    const encoded = encodeSjis(title);
    const reply = await this.sendQuery(
      formatQuery(
        '1807 02201801 00%b 3000 0a00 5000 %w 0000 %w %*',
        fullWidth ? 1 : 0,
        encoded.length,
        sjisLength(current),
        encoded,
      ),
    );
    scanQuery(reply, '1807 02201801 00%? 3000 0a00 5000 %?%? 0000 %?%?');
    if (sharp) {
      await this.descriptor(Descriptor.audioUTOC1TD, CLOSE);
    } else {
      await this.descriptor(Descriptor.discTitleTD, CLOSE);
      await this.descriptor(Descriptor.discTitleTD, OPEN_READ);
      await this.descriptor(Descriptor.discTitleTD, CLOSE);
    }
  }

  /** Writes a track's half-width or full-width title. An unchanged title is not written. */
  async setTrackTitle(track: number, title: string, fullWidth = false): Promise<void> {
    let oldLength: number;
    try {
      const current = await this.getTrackTitle(track, fullWidth);
      if (current === title) return;
      oldLength = sjisLength(current);
    } catch (error) {
      // A track that never had this title is rejected; its old length is zero.
      if (!(error instanceof NetMdRejectedError)) throw error;
      oldLength = 0;
    }
    const descriptor = fullWidth ? Descriptor.audioUTOC4TD : Descriptor.audioUTOC1TD;
    const encoded = encodeSjis(title);
    await this.descriptor(descriptor, OPEN_WRITE);
    const reply = await this.sendQuery(
      formatQuery(
        '1807 022018%b %w 3000 0a00 5000 %w 0000 %w %*',
        fullWidth ? 3 : 2,
        track,
        encoded.length,
        oldLength,
        encoded,
      ),
    );
    scanQuery(reply, '1807 022018%? %?%? 3000 0a00 5000 %?%? 0000 %?%?');
    await this.descriptor(descriptor, CLOSE);
  }

  /** Erases a track. Later tracks move up by one. */
  async eraseTrack(track: number): Promise<void> {
    await this.sendQuery(formatQuery('1840 ff01 00 201001 %w', track));
  }

  /** Moves a track to `destination`; the tracks in between shift by one. */
  async moveTrack(source: number, destination: number): Promise<void> {
    await this.sendQuery(formatQuery('1843 ff00 00 201001 %w 201001 %w', source, destination));
  }
}
