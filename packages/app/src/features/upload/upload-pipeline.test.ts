import { NetMdRejectedError, type UploadTrack } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { ConversionError, type ConvertedTrack } from './convert-track';
import { runUpload, type UploadEvent, type UploadItem, type UploadPort } from './upload-pipeline';

const items = (count: number): UploadItem[] =>
  Array.from({ length: count }, (_, i) => ({
    title: `Track ${String(i + 1)}`,
    fullWidthTitle: '',
  }));

const converted: ConvertedTrack = { mode: 'sp', data: new Uint8Array(4) };

/** A session that records calls; `failAt` makes the upload of that item index fail. */
function fakeSession(options: { failAt?: number; failOpen?: boolean } = {}) {
  const log: string[] = [];
  let next = 3;
  const session: UploadPort = {
    open: () => {
      log.push('open');
      return options.failOpen === true ? Promise.reject(new Error('busy')) : Promise.resolve();
    },
    uploadTrack: (track: UploadTrack, onProgress) => {
      log.push(`upload ${track.title}`);
      if (options.failAt !== undefined && track.title === `Track ${String(options.failAt + 1)}`) {
        return Promise.reject(new NetMdRejectedError('Rejected'));
      }
      onProgress?.({ writtenBytes: 1, totalBytes: 1 });
      return Promise.resolve(next++);
    },
    close: () => {
      log.push('close');
      return Promise.resolve();
    },
  };
  return { session, log };
}

describe('runUpload', () => {
  it('converts each track, uploads it with its titles, then closes', async () => {
    const { session, log } = fakeSession();
    const summary = await runUpload(items(2), {
      convert: () => Promise.resolve(converted),
      session,
      isCancelled: () => false,
    });
    expect(log).toEqual(['open', 'upload Track 1', 'upload Track 2', 'close']);
    expect(summary).toEqual({
      uploaded: [0, 1],
      skipped: [],
      notUploaded: [],
      cancelled: false,
      failure: null,
    });
  });

  it('converts the next track while the current one transfers', async () => {
    const order: string[] = [];
    let secondConversionStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      secondConversionStarted = resolve;
    });
    const { session } = fakeSession();
    const port: UploadPort = {
      ...session,
      uploadTrack: async (track) => {
        order.push(`transfer ${track.title}`);
        // Track 1 finishes only once track 2's conversion has begun: they overlap.
        if (track.title === 'Track 1') await started;
        return 0;
      },
    };
    await runUpload(items(2), {
      convert: (index) => {
        order.push(`convert ${String(index)}`);
        if (index === 1) secondConversionStarted();
        return Promise.resolve(converted);
      },
      session: port,
      isCancelled: () => false,
    });
    expect(order).toEqual(['convert 0', 'convert 1', 'transfer Track 1', 'transfer Track 2']);
  });

  it('skips a track that cannot be converted and keeps going (track-upload: "A file cannot be decoded")', async () => {
    const { session, log } = fakeSession();
    const summary = await runUpload(items(3), {
      convert: (index) =>
        index === 1
          ? Promise.reject(new ConversionError('not-decodable'))
          : Promise.resolve(converted),
      session,
      isCancelled: () => false,
    });
    expect(log).toEqual(['open', 'upload Track 1', 'upload Track 3', 'close']);
    expect(summary.uploaded).toEqual([0, 2]);
    expect(summary.skipped).toEqual([{ index: 1, reason: 'not-decodable' }]);
  });

  it('stops at a device error, keeps what was written and closes (track-upload: "Device fails mid-upload")', async () => {
    const { session, log } = fakeSession({ failAt: 2 });
    const summary = await runUpload(items(5), {
      convert: () => Promise.resolve(converted),
      session,
      isCancelled: () => false,
    });
    expect(log).toEqual(['open', 'upload Track 1', 'upload Track 2', 'upload Track 3', 'close']);
    expect(summary.uploaded).toEqual([0, 1]);
    expect(summary.notUploaded).toEqual([2, 3, 4]);
    expect(summary.failure).toBeInstanceOf(NetMdRejectedError);
  });

  it('stops after the current track when cancelled (track-upload: "Cancel during the second track")', async () => {
    let cancelled = false;
    const { session, log } = fakeSession();
    const port: UploadPort = {
      ...session,
      uploadTrack: (track, onProgress) => {
        if (track.title === 'Track 2') cancelled = true;
        return session.uploadTrack(track, onProgress);
      },
    };
    const summary = await runUpload(items(4), {
      convert: () => Promise.resolve(converted),
      session: port,
      isCancelled: () => cancelled,
    });
    expect(log).toEqual(['open', 'upload Track 1', 'upload Track 2', 'close']);
    expect(summary).toMatchObject({ uploaded: [0, 1], notUploaded: [2, 3], cancelled: true });
  });

  it('uploads nothing and reports the failure when the session cannot open', async () => {
    const { session, log } = fakeSession({ failOpen: true });
    const summary = await runUpload(items(2), {
      convert: () => Promise.resolve(converted),
      session,
      isCancelled: () => false,
    });
    expect(log).toEqual(['open', 'close']);
    expect(summary.notUploaded).toEqual([0, 1]);
    expect(summary.failure).toBeInstanceOf(Error);
  });

  it('reports conversion and transfer progress', async () => {
    const events: UploadEvent[] = [];
    const { session } = fakeSession();
    await runUpload(items(1), {
      convert: (_index, onProgress) => {
        onProgress(0.5);
        return Promise.resolve(converted);
      },
      session,
      isCancelled: () => false,
      onEvent: (event) => events.push(event),
    });
    expect(events).toEqual([
      { kind: 'converting', index: 0, progress: 0 },
      { kind: 'converting', index: 0, progress: 0.5 },
      { kind: 'converting', index: 0, progress: 1 },
      { kind: 'transferring', index: 0, writtenBytes: 0, totalBytes: 1 },
      { kind: 'transferring', index: 0, writtenBytes: 1, totalBytes: 1 },
      { kind: 'uploaded', index: 0, track: 3 },
    ]);
  });
});
