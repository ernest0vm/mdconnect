/*
 * Ported from netmd-js 4.4.1: `prepareDownload` and `download` in src/netmd-commands.ts, and
 * `MDSession` in src/netmd-interface.ts (https://github.com/cybercase/netmd-js), by Stefano Brilli
 * and Asivery, GPL-2.0. The batch shape (open once, upload each track, close once) follows
 * webminidisc's `prepareUpload`, `upload` and `finalizeUpload` (src/services/interfaces/netmd.ts,
 * https://github.com/asivery/webminidisc, GPL-2.0).
 *
 * Changes from upstream:
 * - The wait for a ready device gives up after 30 s; upstream waits forever.
 * - Forgetting and leaving an old session, and disabling new-track protection, ignore only a
 *   rejected or not-implemented reply; upstream ignores every error.
 * - The host nonce comes from an injected random source; upstream uses `Math.random`.
 * - `close` also releases the device, ignores every error, and only undoes the steps that ran,
 *   so it can always be called from a `finally`.
 * - Empty titles are not written, and a full-width title equal to the half-width one is skipped.
 */

import { retailMac } from './des';
import { ekbForDevice } from './ekb';
import { NetMdNotImplementedError, NetMdRejectedError, NetMdTimeoutError } from './errors';
import { UPLOAD_FORMATS, type UploadMode } from './formats';
import type { NetMdInterface, TrackTransferProgress } from './interface';
import { CONTENT_ID, KEY_ENCRYPTION_KEY, paddedLength } from './packets';
import { getDeviceStatus, type OperatingState } from './status';

/** The device commands an upload uses; `NetMdInterface` provides them. */
export type UploadDevice = Pick<
  NetMdInterface,
  | 'acquire'
  | 'release'
  | 'disableNewTrackProtection'
  | 'enterSecureSession'
  | 'leaveSecureSession'
  | 'getLeafId'
  | 'sendKeyData'
  | 'sessionKeyExchange'
  | 'sessionKeyForget'
  | 'setupDownload'
  | 'sendTrack'
  | 'setTrackTitle'
  | 'commitTrack'
>;

/** The device's operating state, read with `getDeviceStatus`. */
export const operatingStateOf = (md: NetMdInterface) => async (): Promise<OperatingState> =>
  (await getDeviceStatus(md)).state;

export interface UploadSessionOptions {
  readonly vendorId: number;
  readonly productId: number;
  /** What the device is doing; see `operatingStateOf`. */
  readonly operatingState: () => Promise<OperatingState>;
  /** Returns `length` random bytes, for the host nonce. */
  readonly random: (length: number) => Uint8Array;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** One track to upload, its audio already split into encrypted packets (see packets.ts). */
export interface UploadTrack {
  readonly mode: UploadMode;
  /** The audio's length in the wire format, before padding to whole frames. */
  readonly dataLength: number;
  readonly packets: AsyncIterable<Uint8Array<ArrayBuffer>>;
  /** Already converted for the disc (see sanitize.ts). */
  readonly title: string;
  readonly fullWidthTitle?: string | undefined;
}

const READY_STATES: readonly OperatingState[] = ['ready', 'discBlank'];
const READY_POLL_MS = 200;
const READY_ATTEMPTS = 150;
const NONCE_LENGTH = 8;

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isRefusal = (error: unknown) =>
  error instanceof NetMdRejectedError || error instanceof NetMdNotImplementedError;

/** Runs a step whose refusal means "nothing to do". */
async function unlessRefused(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error) {
    if (!isRefusal(error)) throw error;
  }
}

/** Runs a clean-up step, ignoring any error so the original failure is the one reported. */
async function quietly(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch {
    // The device may already have left the session, or be unplugged.
  }
}

/**
 * The device's secure upload session: open it once, upload each track, and close it in every
 * outcome.
 */
export class UploadSession {
  private readonly sleep: (ms: number) => Promise<void>;
  private acquired = false;
  private entered = false;
  private sessionKey: Uint8Array | null = null;

  constructor(
    private readonly device: UploadDevice,
    private readonly options: UploadSessionOptions,
  ) {
    this.sleep = options.sleep ?? realSleep;
  }

  async open(): Promise<void> {
    await this.waitUntilReady();
    await unlessRefused(() => this.device.sessionKeyForget());
    await unlessRefused(() => this.device.leaveSecureSession());
    await this.device.acquire();
    this.acquired = true;
    // Sharp decks reject this; their tracks stay changeable anyway.
    await unlessRefused(() => this.device.disableNewTrackProtection(1));
    await this.device.enterSecureSession();
    this.entered = true;
    const leafId = await this.device.getLeafId();
    const ekb = ekbForDevice(leafId, this.options.vendorId, this.options.productId);
    await this.device.sendKeyData(ekb.id, ekb.chain, ekb.depth, ekb.signature);
    const hostNonce = this.options.random(NONCE_LENGTH);
    const deviceNonce = await this.device.sessionKeyExchange(hostNonce);
    this.sessionKey = retailMac(ekb.rootKey, new Uint8Array([...hostNonce, ...deviceNonce]));
  }

  /** Uploads one track and returns its zero-based number on the disc. */
  async uploadTrack(
    track: UploadTrack,
    onProgress?: (progress: TrackTransferProgress) => void,
  ): Promise<number> {
    const sessionKey = this.sessionKey;
    if (sessionKey === null) throw new Error('Open the upload session first');
    const format = UPLOAD_FORMATS[track.mode];
    const dataLength = paddedLength(track.dataLength, format.frameSize);
    await this.device.setupDownload(CONTENT_ID, KEY_ENCRYPTION_KEY, sessionKey);
    const sent = await this.device.sendTrack(
      {
        wireFormat: format.wireFormat,
        discFormat: format.discFormat,
        frames: dataLength / format.frameSize,
        dataLength,
      },
      track.packets,
      sessionKey,
      onProgress,
    );
    if (track.title !== '') await this.device.setTrackTitle(sent.track, track.title);
    const fullWidth = track.fullWidthTitle ?? '';
    if (fullWidth !== '' && fullWidth !== track.title) {
      await this.device.setTrackTitle(sent.track, fullWidth, true);
    }
    await this.device.commitTrack(sent.track, sessionKey);
    return sent.track;
  }

  /** Ends the session and releases the device, undoing only what `open` did. Never throws. */
  async close(): Promise<void> {
    if (this.sessionKey !== null) await quietly(() => this.device.sessionKeyForget());
    if (this.entered) await quietly(() => this.device.leaveSecureSession());
    if (this.acquired) await quietly(() => this.device.release());
    this.sessionKey = null;
    this.entered = false;
    this.acquired = false;
  }

  /** Waits for the device to settle: the setup is rejected while it is still busy. */
  private async waitUntilReady(): Promise<void> {
    for (let attempt = 0; attempt < READY_ATTEMPTS; attempt++) {
      if (READY_STATES.includes(await this.options.operatingState())) return;
      await this.sleep(READY_POLL_MS);
    }
    throw new NetMdTimeoutError('The device did not become ready for an upload');
  }
}
