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
   * `not-netmd`: the device did not answer NetMD at all, for example a Hi-MD device in Hi-MD mode.
   * `read-failed`: it answered, but reading the disc failed.
   */
  | { readonly kind: 'failed'; readonly reason: 'not-netmd' | 'read-failed' };

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

/**
 * Reads the disc in one connected device. Reads run one at a time: a Refresh waits for the read
 * in progress. The NetMD session is opened on the first read and reused.
 */
export class DiscReader {
  private session: Promise<DiscSession> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly openSession: () => Promise<DiscSession>) {}

  read(): Promise<DiscReadResult> {
    const next = this.queue.then(() => this.readOnce());
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async readOnce(): Promise<DiscReadResult> {
    let session: DiscSession;
    let present: boolean;
    try {
      this.session ??= this.openSession();
      session = await this.session;
      present = await session.isDiscPresent();
    } catch {
      this.session = null;
      return { kind: 'failed', reason: 'not-netmd' };
    }
    if (!present) return { kind: 'no-disc' };
    try {
      return { kind: 'disc', disc: toDiscView(await session.listContent()) };
    } catch {
      return { kind: 'failed', reason: 'read-failed' };
    }
  }
}
