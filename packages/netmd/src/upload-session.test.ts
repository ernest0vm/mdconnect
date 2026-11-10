import { describe, expect, it } from 'vitest';

import { retailMac } from './des';
import { NetMdRejectedError, NetMdTimeoutError } from './errors';
import type { SentTrack, TrackTransfer } from './interface';
import { CONTENT_ID, KEY_ENCRYPTION_KEY } from './packets';
import type { OperatingState } from './status';
import { UploadSession, type UploadDevice } from './upload-session';

const HOST_NONCE = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const DEVICE_NONCE = new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9]);
const OPEN_SOURCE_ROOT = new Uint8Array([
  0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x0f, 0xed, 0xcb, 0xa9, 0x87, 0x65, 0x43, 0x21,
]);
const SESSION_KEY = retailMac(OPEN_SOURCE_ROOT, new Uint8Array([...HOST_NONCE, ...DEVICE_NONCE]));

interface FakeOptions {
  readonly states?: OperatingState[];
  readonly reject?: ReadonlySet<string>;
  /** Errors by call name; the test may add entries after opening. */
  readonly fail?: ReadonlyMap<string, Error>;
}

/** A device that records each call and answers like a deck that accepts everything. */
function fakeDevice(options: FakeOptions = {}) {
  const calls: string[] = [];
  const transfers: TrackTransfer[] = [];
  const states = [...(options.states ?? ['ready'])];
  let nextTrack = 4;
  const run = (name: string) => {
    calls.push(name);
    const failure = options.fail?.get(name);
    if (failure) return Promise.reject(failure);
    if (options.reject?.has(name)) return Promise.reject(new NetMdRejectedError('Rejected'));
    return Promise.resolve();
  };
  const operatingState = () =>
    Promise.resolve(states.length > 1 ? (states.shift() ?? 'ready') : (states[0] ?? 'ready'));
  const device: UploadDevice = {
    acquire: () => run('acquire'),
    release: () => run('release'),
    disableNewTrackProtection: () => run('disableNewTrackProtection'),
    enterSecureSession: () => run('enterSecureSession'),
    leaveSecureSession: () => run('leaveSecureSession'),
    getLeafId: () => run('getLeafId').then(() => new Uint8Array(8)),
    sendKeyData: (id) => run(`sendKeyData ${id.toString(16)}`),
    sessionKeyExchange: (nonce) => {
      expect(nonce).toEqual(HOST_NONCE);
      return run('sessionKeyExchange').then(() => DEVICE_NONCE);
    },
    sessionKeyForget: () => run('sessionKeyForget'),
    setupDownload: (contentId, kek, sessionKey) => {
      expect(contentId).toEqual(CONTENT_ID);
      expect(kek).toEqual(KEY_ENCRYPTION_KEY);
      expect(sessionKey).toEqual(SESSION_KEY);
      return run('setupDownload');
    },
    sendTrack: async (transfer, packets, sessionKey, onProgress): Promise<SentTrack> => {
      expect(sessionKey).toEqual(SESSION_KEY);
      transfers.push(transfer);
      await run('sendTrack');
      for await (const packet of packets)
        onProgress?.({ writtenBytes: packet.length, totalBytes: 1 });
      return { track: nextTrack++, uuid: new Uint8Array(8), contentId: new Uint8Array(20) };
    },
    setTrackTitle: (track, title, fullWidth) =>
      run(`setTrackTitle ${String(track)} ${title}${fullWidth === true ? ' (full)' : ''}`),
    commitTrack: (track, sessionKey) => {
      expect(sessionKey).toEqual(SESSION_KEY);
      return run(`commitTrack ${String(track)}`);
    },
  };
  return { device: Object.assign(device, { operatingState }), calls, transfers };
}

async function* packetsOf(...sizes: number[]) {
  await Promise.resolve();
  for (const size of sizes) yield new Uint8Array(size);
}

type FakeDevice = UploadDevice & { operatingState: () => Promise<OperatingState> };

const session = (device: FakeDevice, sleeps: number[] = []) =>
  new UploadSession(device, {
    vendorId: 0x054c,
    productId: 0x00ca,
    operatingState: device.operatingState,
    random: () => HOST_NONCE.slice(),
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  });

const OPEN_SEQUENCE = [
  'sessionKeyForget',
  'leaveSecureSession',
  'acquire',
  'disableNewTrackProtection',
  'enterSecureSession',
  'getLeafId',
  'sendKeyData 26422642',
  'sessionKeyExchange',
];

describe('UploadSession', () => {
  it('opens the secure session in upstream order', async () => {
    const { device, calls } = fakeDevice();
    await session(device).open();
    expect(calls).toEqual(OPEN_SEQUENCE);
  });

  it('waits until the device is ready before opening', async () => {
    const { device, calls } = fakeDevice({ states: ['readingTOC', 'playing', 'discBlank'] });
    const sleeps: number[] = [];
    await session(device, sleeps).open();
    expect(sleeps).toEqual([200, 200]);
    expect(calls[0]).toBe('sessionKeyForget');
  });

  it('gives up when the device never becomes ready', async () => {
    const { device } = fakeDevice({ states: ['noDisc'] });
    await expect(session(device).open()).rejects.toBeInstanceOf(NetMdTimeoutError);
  });

  it('carries on when there was no session to forget or leave', async () => {
    const { device, calls } = fakeDevice({
      reject: new Set(['sessionKeyForget', 'leaveSecureSession']),
    });
    await session(device).open();
    expect(calls).toEqual(OPEN_SEQUENCE);
  });

  it('carries on when the deck rejects disabling new-track protection (Sharp)', async () => {
    const { device } = fakeDevice({ reject: new Set(['disableNewTrackProtection']) });
    await expect(session(device).open()).resolves.toBeUndefined();
  });

  it('uploads a track: setup, transfer, titles, then commit (track-upload: "Titles written")', async () => {
    const { device, calls, transfers } = fakeDevice();
    const upload = session(device);
    await upload.open();
    calls.length = 0;
    const track = await upload.uploadTrack({
      mode: 'lp2',
      dataLength: 5000,
      packets: packetsOf(1024, 1024),
      title: 'Opening',
      fullWidthTitle: '序曲',
    });
    expect(track).toBe(4);
    expect(calls).toEqual([
      'setupDownload',
      'sendTrack',
      'setTrackTitle 4 Opening',
      'setTrackTitle 4 序曲 (full)',
      'commitTrack 4',
    ]);
    // 5000 bytes are 27 LP2 frames, padded to 5184 bytes.
    expect(transfers).toEqual([
      { wireFormat: 0x94, discFormat: 0x02, frames: 27, dataLength: 5184 },
    ]);
  });

  it('skips an empty title and a full-width title equal to the half-width one', async () => {
    const { device, calls } = fakeDevice();
    const upload = session(device);
    await upload.open();
    calls.length = 0;
    await upload.uploadTrack({ mode: 'sp', dataLength: 10, packets: packetsOf(34), title: '' });
    await upload.uploadTrack({
      mode: 'sp',
      dataLength: 10,
      packets: packetsOf(34),
      title: 'A',
      fullWidthTitle: 'A',
    });
    expect(calls.filter((c) => c.startsWith('setTrackTitle'))).toEqual(['setTrackTitle 5 A']);
  });

  it('reports transfer progress', async () => {
    const { device } = fakeDevice();
    const upload = session(device);
    await upload.open();
    const progress: number[] = [];
    await upload.uploadTrack(
      { mode: 'lp4', dataLength: 96, packets: packetsOf(120), title: 'x' },
      (p) => progress.push(p.writtenBytes),
    );
    expect(progress).toEqual([120]);
  });

  it('refuses to upload before the session is open', async () => {
    const { device } = fakeDevice();
    await expect(
      session(device).uploadTrack({ mode: 'sp', dataLength: 1, packets: packetsOf(1), title: '' }),
    ).rejects.toThrow(/open/i);
  });

  it('closes: forgets the key, leaves the session and releases the device', async () => {
    const { device, calls } = fakeDevice();
    const upload = session(device);
    await upload.open();
    calls.length = 0;
    await upload.close();
    expect(calls).toEqual(['sessionKeyForget', 'leaveSecureSession', 'release']);
  });

  it('closes after a failed transfer, ignoring further errors (track-upload: "Device fails mid-upload")', async () => {
    const fail = new Map<string, Error>();
    const { device, calls } = fakeDevice({ fail });
    const upload = session(device);
    await upload.open();
    const gone = new Error('gone');
    fail.set('sendTrack', new NetMdRejectedError('Rejected'));
    for (const name of ['sessionKeyForget', 'leaveSecureSession', 'release']) fail.set(name, gone);
    await expect(
      upload.uploadTrack({ mode: 'sp', dataLength: 1, packets: packetsOf(1), title: '' }),
    ).rejects.toBeInstanceOf(NetMdRejectedError);
    calls.length = 0;
    await expect(upload.close()).resolves.toBeUndefined();
    expect(calls).toEqual(['sessionKeyForget', 'leaveSecureSession', 'release']);
  });

  it('closes a session that failed to open by releasing the device only', async () => {
    const { device, calls } = fakeDevice({
      fail: new Map([['enterSecureSession', new NetMdRejectedError('Rejected')]]),
    });
    const upload = session(device);
    await expect(upload.open()).rejects.toBeInstanceOf(NetMdRejectedError);
    calls.length = 0;
    await upload.close();
    expect(calls).toEqual(['release']);
  });

  it('does nothing when closed twice', async () => {
    const { device, calls } = fakeDevice();
    const upload = session(device);
    await upload.open();
    await upload.close();
    calls.length = 0;
    await upload.close();
    expect(calls).toEqual([]);
  });
});
