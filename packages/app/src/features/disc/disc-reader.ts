import {
  listContent,
  NetMdInterface,
  NetMdRejectedError,
  NetMdTransport,
  renameDisc,
  rewriteDiscGroups,
  type Disc,
} from '@mdconnect/netmd';

import type { UsbDeviceHandle } from '../../platform';
import { toDiscView, type DiscView } from './disc-view';
import type { EditCommand, EditPlan } from './edit-plan';

/** The NetMD queries the reader needs; a real session talks to the device. */
export interface DiscSession {
  isDiscPresent(): Promise<boolean>;
  listContent(): Promise<Disc>;
  /** Sends one edit to the device. */
  run(command: EditCommand): Promise<void>;
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

/**
 * `rejected`: the device refused the change, for example a title it cannot store.
 * `failed`: the session could not be opened, or a command failed or timed out.
 */
export type EditOutcome =
  { readonly kind: 'saved' } | { readonly kind: 'failed'; readonly reason: 'rejected' | 'failed' };

export interface EditResult {
  readonly outcome: EditOutcome;
  /** The disc as read after the edit, whether it succeeded or not. */
  readonly result: DiscReadResult;
}

/** Opens a NetMD session on a connected device: claims its interface and drains stale replies. */
export async function openNetMdSession(handle: UsbDeviceHandle): Promise<DiscSession> {
  const transport = new NetMdTransport(handle);
  await transport.init();
  const md = new NetMdInterface(transport, { vendorId: handle.vendorId });
  return {
    isDiscPresent: () => md.isDiscPresent(),
    listContent: () => listContent(md),
    run: (command) => runCommand(md, command),
  };
}

async function runCommand(md: NetMdInterface, command: EditCommand): Promise<void> {
  switch (command.kind) {
    case 'renameDisc':
      return renameDisc(md, command.title, command.fullWidthTitle);
    case 'setTrackTitle':
      return md.setTrackTitle(command.track, command.title, command.fullWidth);
    case 'eraseTrack':
      return md.eraseTrack(command.track);
    case 'moveTrack':
      return md.moveTrack(command.from, command.to);
    case 'rewriteGroups':
      return rewriteDiscGroups(md, command.disc);
  }
}

export interface DiscReaderOptions {
  /**
   * Whether the device shows positive evidence of Hi-MD mode (see `isHiMdMode`). Asked on every
   * read and again after opening fails, because the configuration may only be known by then.
   */
  readonly hiMdMode?: () => boolean;
}

/**
 * Reads and edits the disc in one connected device. The NetMD session is opened on the first use
 * and reused, except after a failure. Reads and edits run one at a time, in order.
 */
export class DiscReader {
  private session: Promise<DiscSession> | null = null;
  private inFlight: Promise<DiscReadResult> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly openSession: () => Promise<DiscSession>,
    private readonly options: DiscReaderOptions = {},
  ) {}

  /** A read requested while another is in progress shares it, so reads never overlap. */
  read(): Promise<DiscReadResult> {
    this.inFlight ??= this.share(this.exclusive(() => this.readOnce()));
    return this.inFlight;
  }

  /**
   * Runs an edit after any read or edit in progress, stopping at the first failed command, then
   * reads the disc again. A read requested meanwhile shares that read.
   */
  edit(plan: EditPlan): Promise<EditResult> {
    const done = this.exclusive(async () => {
      const outcome = await this.runPlan(plan);
      return { outcome, result: await this.readOnce() };
    });
    this.inFlight = this.share(done.then(({ result }) => result));
    return done;
  }

  private share(read: Promise<DiscReadResult>): Promise<DiscReadResult> {
    const shared = read.finally(() => {
      if (this.inFlight === shared) this.inFlight = null;
    });
    return shared;
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runPlan(plan: EditPlan): Promise<EditOutcome> {
    try {
      this.session ??= this.openSession();
      const session = await this.session;
      for (const command of plan.commands) await session.run(command);
      return { kind: 'saved' };
    } catch (error) {
      // Reopen before reading again: initialising the transport drains a stale reply.
      this.session = null;
      return {
        kind: 'failed',
        reason: error instanceof NetMdRejectedError ? 'rejected' : 'failed',
      };
    }
  }

  /**
   * Hi-MD mode is reported only on positive evidence (`hiMdMode`). A session that cannot be
   * opened is "unavailable"; a failed or timed-out query is a failed read. Both can be retried.
   */
  private async readOnce(): Promise<DiscReadResult> {
    const hiMdMode = this.options.hiMdMode ?? (() => false);
    if (hiMdMode()) return { kind: 'failed', reason: 'not-netmd' };
    let session: DiscSession;
    try {
      this.session ??= this.openSession();
      session = await this.session;
    } catch {
      this.session = null;
      return { kind: 'failed', reason: hiMdMode() ? 'not-netmd' : 'unavailable' };
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
