import {
  getDeviceStatus,
  listContent,
  NetMdInterface,
  NetMdRejectedError,
  NetMdTimeoutError,
  NetMdTransport,
  renameDisc,
  rewriteDiscGroups,
  NetMdNotImplementedError,
  operatingStateOf,
  UploadSession,
  type DeviceStatus,
  type Disc,
} from '@mdconnect/netmd';

import type { UsbDeviceHandle } from '../../platform';
import type { UploadPort, UploadSummary } from '../upload/upload-pipeline';
import { toDiscView, type DiscView } from './disc-view';
import type { EditCommand, EditPlan } from './edit-plan';

/** The NetMD queries the reader needs; a real session talks to the device. */
export interface DiscSession {
  isDiscPresent(): Promise<boolean>;
  listContent(): Promise<Disc>;
  /** Sends one edit to the device. */
  run(command: EditCommand): Promise<void>;
  /** Sends one playback command to the device. */
  playback(command: PlaybackCommand): Promise<void>;
  /** Reads what the device is doing. */
  deviceStatus(): Promise<DeviceStatus>;
  /** Ends the session with the device, as netmd-js `finalize` does: reset, release, close. */
  end?(): Promise<void>;
  /** A secure upload session on this device; absent where uploads are not possible. */
  uploadSession?(): UploadPort;
}

/** A playback control. Unlike an edit, it does not change the disc, so the disc is not read again. */
export type PlaybackCommand =
  | { readonly kind: 'play' | 'pause' | 'stop' | 'next' | 'previous' }
  | { readonly kind: 'goto'; readonly track: number }
  /** Goes to a track and plays it, as one step in the queue (webminidisc's goto then play). */
  | { readonly kind: 'playTrack'; readonly track: number };

/** Where playback is, so Next and Previous can stop at the ends and fall back when rejected. */
export interface PlaybackPosition {
  readonly track: number | null;
  readonly trackCount: number;
}

export type ControlOutcome =
  { readonly kind: 'done' } | { readonly kind: 'failed'; readonly reason: 'rejected' | 'failed' };

export interface ControlResult {
  readonly outcome: ControlOutcome;
  /** The status read after the command, or null when it could not be read. */
  readonly status: DeviceStatus | null;
}

/** How long a device takes to settle after a control, before its status means anything (webminidisc). */
const SETTLE_MS = 500;

export type DiscReadResult =
  /** `raw` is the disc as read, which edits are planned from. */
  | { readonly kind: 'disc'; readonly disc: DiscView; readonly raw: Disc }
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
 * `unsupported-title`: a title has a character the disc cannot store; nothing of it was sent.
 */
export type EditOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly reason: 'rejected' | 'failed' | 'unsupported-title' };

export interface EditResult {
  readonly outcome: EditOutcome;
  /** The disc as read after the edit, whether it succeeded or not. */
  readonly result: DiscReadResult;
}

/** `failed`: the session could not be opened, so nothing was uploaded. */
export type UploadOutcome =
  { readonly kind: 'done'; readonly summary: UploadSummary } | { readonly kind: 'failed' };

export interface UploadResult {
  readonly outcome: UploadOutcome;
  /** The disc as read after the upload. */
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
    end: async () => {
      // As netmd-js finalize: errors are ignored, the device may already be gone.
      for (const step of [
        () => handle.reset?.(),
        () => handle.releaseInterface?.(0),
        () => handle.close(),
      ]) {
        try {
          await step();
        } catch {
          // Nothing to do.
        }
      }
    },
    playback: (command) => runPlayback(md, command),
    deviceStatus: () => getDeviceStatus(md),
    uploadSession: () =>
      new UploadSession(md, {
        vendorId: handle.vendorId,
        productId: handle.productId,
        operatingState: operatingStateOf(md),
        random: (length) => crypto.getRandomValues(new Uint8Array(length)),
      }),
  };
}

/** Maps an error from an edit to the reason shown to the user. */
function isRefusal(error: unknown): boolean {
  return error instanceof NetMdRejectedError || error instanceof NetMdNotImplementedError;
}

/** Maps an error from an edit to the reason shown to the user. */
function failureReason(error: unknown): Extract<EditOutcome, { kind: 'failed' }>['reason'] {
  if (error instanceof NetMdRejectedError) return 'rejected';
  // encodeSjis throws RangeError before anything is sent.
  if (error instanceof RangeError) return 'unsupported-title';
  return 'failed';
}

/** Sends one edit command to the device through the NetMD interface. */
/** Sends one playback command through the NetMD interface. */
async function runPlayback(md: NetMdInterface, command: PlaybackCommand): Promise<void> {
  switch (command.kind) {
    case 'play':
      return md.play();
    case 'pause':
      return md.pause();
    case 'stop':
      return md.stop();
    case 'next':
      return md.nextTrack();
    case 'previous':
      return md.previousTrack();
    case 'goto':
      await md.gotoTrack(command.track);
      return;
    case 'playTrack':
      await md.gotoTrack(command.track);
      await md.play();
      return;
  }
}

/** Sends one edit command to the device through the NetMD interface. */
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
    case 'stop':
      return md.stop();
    case 'eraseDisc':
      return md.eraseDisc();
  }
}

export interface DiscReaderOptions {
  /**
   * Whether the device shows positive evidence of Hi-MD mode (see `isHiMdMode`). Asked on every
   * read and again after opening fails, because the configuration may only be known by then.
   */
  readonly hiMdMode?: () => boolean;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Reads and edits the disc in one connected device. The NetMD session is opened on the first use
 * and reused, except after a failure. Reads and edits run one at a time, in order.
 */
export class DiscReader {
  private session: Promise<DiscSession> | null = null;
  private inFlight: Promise<DiscReadResult> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private statusInFlight: Promise<DeviceStatus | null> | null = null;
  /** Set by close(): the device's session has ended for good. */
  private closed = false;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly openSession: () => Promise<DiscSession>,
    private readonly options: DiscReaderOptions = {},
  ) {
    this.sleep =
      options.sleep ??
      ((ms) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
  }

  /**
   * Sends a playback control after anything already queued, waits for the device to settle and
   * reads its status. Next on the last track and Previous on the first send nothing.
   */
  control(command: PlaybackCommand, at: PlaybackPosition): Promise<ControlResult> {
    const atEnd =
      (command.kind === 'next' && at.track === at.trackCount - 1) ||
      (command.kind === 'previous' && at.track === 0);
    if (atEnd) {
      return this.status().then((status) => ({ outcome: { kind: 'done' }, status }));
    }
    return this.exclusive(async () => {
      const outcome = await this.runControl(command, at);
      await this.sleep(SETTLE_MS);
      return { outcome, status: await this.readStatus() };
    });
  }

  /**
   * Ends the session after anything already queued. The reader is done afterwards: later reads,
   * edits and status polls fail without opening the device again.
   */
  close(): Promise<void> {
    return this.exclusive(async () => {
      this.closed = true;
      const session = this.session;
      this.session = null;
      if (session === null) return;
      try {
        await (await session).end?.();
      } catch {
        // A session that never opened has nothing to end.
      }
    });
  }

  /** The device's status, read after anything already queued and shared while in flight. */
  status(): Promise<DeviceStatus | null> {
    this.statusInFlight ??= this.exclusive(() => this.readStatus()).finally(() => {
      this.statusInFlight = null;
    });
    return this.statusInFlight;
  }

  /** Opens a session, unless close() has ended this reader's use of the device. */
  private openNewSession(): Promise<DiscSession> {
    return this.closed
      ? Promise.reject(new Error('The session with the device has ended.'))
      : this.openSession();
  }

  /** Positive evidence of Hi-MD mode: never open a NetMD session on such a device. */
  private inHiMdMode(): boolean {
    return this.options.hiMdMode?.() ?? false;
  }

  /** Reads the device's status; null when it cannot be read or the device is in Hi-MD mode. */
  private async readStatus(): Promise<DeviceStatus | null> {
    if (this.inHiMdMode()) return null;
    try {
      this.session ??= this.openNewSession();
      return await (await this.session).deviceStatus();
    } catch (error) {
      // A device that refuses status queries keeps its session; only a broken one is reopened.
      if (!isRefusal(error)) this.session = null;
      return null;
    }
  }

  private async runControl(
    command: PlaybackCommand,
    at: PlaybackPosition,
  ): Promise<ControlOutcome> {
    if (this.inHiMdMode()) return { kind: 'failed', reason: 'failed' };
    try {
      this.session ??= this.openNewSession();
      const session = await this.session;
      try {
        await session.playback(command);
      } catch (error) {
        const step = command.kind === 'next' ? 1 : command.kind === 'previous' ? -1 : 0;
        if (step === 0 || at.track === null || !isRefusal(error)) throw error;
        // Some devices do not support next and previous: do what webminidisc does.
        await session.playback({ kind: 'stop' });
        await session.playback({ kind: 'goto', track: at.track + step });
        await session.playback({ kind: 'play' });
      }
      return { kind: 'done' };
    } catch (error) {
      this.session = null;
      return { kind: 'failed', reason: isRefusal(error) ? 'rejected' : 'failed' };
    }
  }

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

  /**
   * Uploads tracks as one queued step: stops playback, runs `upload` on the device's upload
   * session, then reads the disc again. Status polls, edits and reads wait for all of it.
   */
  upload(upload: (session: UploadPort) => Promise<UploadSummary>): Promise<UploadResult> {
    const done = this.exclusive(async () => {
      const outcome = await this.runUpload(upload);
      return { outcome, result: await this.readOnce() };
    });
    this.inFlight = this.share(done.then(({ result }) => result));
    return done;
  }

  private async runUpload(
    upload: (session: UploadPort) => Promise<UploadSummary>,
  ): Promise<UploadOutcome> {
    let session: DiscSession;
    try {
      this.session ??= this.openNewSession();
      session = await this.session;
    } catch {
      this.session = null;
      return { kind: 'failed' };
    }
    const port = session.uploadSession?.();
    if (port === undefined) return { kind: 'failed' };
    try {
      await session.playback({ kind: 'stop' });
    } catch {
      // A device that refuses to stop is not playing.
    }
    let summary: UploadSummary;
    try {
      summary = await upload(port);
    } catch {
      // The upload broke off unexpectedly; the read after it shows what reached the disc.
      this.session = null;
      return { kind: 'failed' };
    }
    // Reopen before reading again: initialising the transport drains a stale reply.
    if (summary.failure !== null) this.session = null;
    return { kind: 'done', summary };
  }

  /** Makes a read the one later read() calls share until it settles. */
  private share(read: Promise<DiscReadResult>): Promise<DiscReadResult> {
    const shared = read.finally(() => {
      if (this.inFlight === shared) this.inFlight = null;
    });
    return shared;
  }

  /** Runs a task after every read or edit already queued. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Runs the plan commands in order and recovers if one fails part way. */
  private async runPlan(plan: EditPlan): Promise<EditOutcome> {
    let session: DiscSession;
    try {
      this.session ??= this.openNewSession();
      session = await this.session;
    } catch {
      this.session = null;
      return { kind: 'failed', reason: 'failed' };
    }
    let completed = 0;
    try {
      for (const command of plan.commands) {
        await session.run(command);
        completed++;
      }
      return { kind: 'saved' };
    } catch (error) {
      await this.recover(session, plan, completed);
      // Reopen before reading again: initialising the transport drains a stale reply.
      this.session = null;
      return { kind: 'failed', reason: failureReason(error) };
    }
  }

  /** Best effort: if the device stopped answering, the re-read shows what it holds anyway. */
  private async recover(session: DiscSession, plan: EditPlan, completed: number): Promise<void> {
    try {
      for (const command of plan.recovery?.(completed) ?? []) await session.run(command);
    } catch {
      // Nothing more to do here.
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
      this.session ??= this.openNewSession();
      session = await this.session;
    } catch (error) {
      this.session = null;
      if (hiMdMode()) return { kind: 'failed', reason: 'not-netmd' };
      // A device that stops answering while the session opens is not in use by someone else.
      return {
        kind: 'failed',
        reason: error instanceof NetMdTimeoutError ? 'read-failed' : 'unavailable',
      };
    }
    try {
      if (!(await session.isDiscPresent())) return { kind: 'no-disc' };
      const raw = await session.listContent();
      return { kind: 'disc', disc: toDiscView(raw), raw };
    } catch {
      // Reopen on Retry: initialising the transport drains a reply a failed command left behind.
      this.session = null;
      return { kind: 'failed', reason: 'read-failed' };
    }
  }
}
