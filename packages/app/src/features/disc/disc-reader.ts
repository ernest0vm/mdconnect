import { listContent, NetMdInterface, NetMdTransport, type Disc } from '@mdconnect/netmd';

import type { UsbDeviceHandle } from '../../platform';
import { toDiscView, type DiscView } from './disc-view';

/** The NetMD queries the reader needs; a real session talks to the device. */
export interface DiscSession {
  isDiscPresent(): Promise<boolean>;
  listContent(): Promise<Disc>;
}

export type DiscReadResult =
  | { readonly kind: 'disc'; readonly disc: DiscView }
  | { readonly kind: 'no-disc' }
  /**
   * `not-netmd`: the device is in Hi-MD mode (positive evidence, see `isHiMdMode`).
   * `unavailable`: the NetMD session could not be opened, for example another app holds the device.
   * `read-failed`: the session opened, but reading the disc failed or timed out.
   */
  | { readonly kind: 'failed'; readonly reason: 'not-netmd' | 'unavailable' | 'read-failed' };

/** Opens a NetMD session on a connected device: claims its interface and drains stale replies. */
export async function openNetMdSession(handle: UsbDeviceHandle): Promise<DiscSession> {
  const transport = new NetMdTransport(handle);
  await transport.init();
  const md = new NetMdInterface(transport);
  return {
    isDiscPresent: () => md.isDiscPresent(),
    listContent: () => listContent(md),
  };
}

export interface DiscReaderOptions {
  /** The device is known to be in Hi-MD mode (see `isHiMdMode`), so NetMD cannot read it. */
  readonly hiMdModeOnly?: boolean;
}

/**
 * Reads the disc in one connected device. The NetMD session is opened on the first read and
 * reused, except after a failed read.
 */
export class DiscReader {
  private session: Promise<DiscSession> | null = null;
  private inFlight: Promise<DiscReadResult> | null = null;

  constructor(
    private readonly openSession: () => Promise<DiscSession>,
    private readonly options: DiscReaderOptions = {},
  ) {}

  /** A read requested while another is in progress shares it, so reads never overlap. */
  read(): Promise<DiscReadResult> {
    this.inFlight ??= this.readOnce().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * Hi-MD mode is reported only on positive evidence (`hiMdModeOnly`). A session that cannot be
   * opened is "unavailable"; a failed or timed-out query is a failed read. Both can be retried.
   */
  private async readOnce(): Promise<DiscReadResult> {
    if (this.options.hiMdModeOnly === true) return { kind: 'failed', reason: 'not-netmd' };
    let session: DiscSession;
    try {
      this.session ??= this.openSession();
      session = await this.session;
    } catch {
      this.session = null;
      return { kind: 'failed', reason: 'unavailable' };
    }
    try {
      if (!(await session.isDiscPresent())) return { kind: 'no-disc' };
      return { kind: 'disc', disc: toDiscView(await session.listContent()) };
    } catch {
      // Reopen on Retry: initialising the transport drains a reply a failed command left behind.
      this.session = null;
      return { kind: 'failed', reason: 'read-failed' };
    }
  }
}
