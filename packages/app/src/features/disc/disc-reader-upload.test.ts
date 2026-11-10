import { FRAMES_PER_SECOND, type Disc } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import type { UploadPort, UploadSummary } from '../upload/upload-pipeline';
import { DiscReader, type DiscSession } from './disc-reader';

const disc: Disc = {
  title: '',
  fullWidthTitle: '',
  writable: true,
  writeProtected: false,
  used: 0,
  left: 80 * 60 * FRAMES_PER_SECOND,
  total: 80 * 60 * FRAMES_PER_SECOND,
  trackCount: 0,
  groups: [],
};

const done: UploadSummary = {
  uploaded: [0],
  skipped: [],
  notUploaded: [],
  cancelled: false,
  failure: null,
};

const port: UploadPort = {
  open: () => Promise.resolve(),
  uploadTrack: () => Promise.resolve(0),
  close: () => Promise.resolve(),
};

function session(log: string[], overrides: Partial<DiscSession> = {}): DiscSession {
  return {
    isDiscPresent: () => Promise.resolve(true),
    listContent: () => {
      log.push('read');
      return Promise.resolve(disc);
    },
    run: () => Promise.resolve(),
    playback: (command) => {
      log.push(`playback ${command.kind}`);
      return Promise.resolve();
    },
    deviceStatus: () => {
      log.push('status');
      return Promise.resolve({ discPresent: true, state: 'ready', track: 0, time: null });
    },
    uploadSession: () => port,
    ...overrides,
  };
}

describe('DiscReader.upload', () => {
  it('stops playback, runs the upload and reads the disc again (track-upload: "Playback stopped")', async () => {
    const log: string[] = [];
    const reader = new DiscReader(() => Promise.resolve(session(log)));
    const result = await reader.upload((upload) => {
      expect(upload).toBe(port);
      log.push('upload');
      return Promise.resolve(done);
    });
    expect(log).toEqual(['playback stop', 'upload', 'read']);
    expect(result.outcome).toEqual({ kind: 'done', summary: done });
    expect(result.result.kind).toBe('disc');
  });

  it('makes a status poll wait until the upload and the read after it are done', async () => {
    const log: string[] = [];
    const reader = new DiscReader(() => Promise.resolve(session(log)));
    const uploading = reader.upload(
      () =>
        new Promise<UploadSummary>((resolve) => {
          setTimeout(() => {
            log.push('upload done');
            resolve(done);
          }, 0);
        }),
    );
    const status = reader.status();
    await uploading;
    await status;
    expect(log).toEqual(['playback stop', 'upload done', 'read', 'status']);
  });

  it('carries on when the device refuses to stop', async () => {
    const log: string[] = [];
    const reader = new DiscReader(() =>
      Promise.resolve(session(log, { playback: () => Promise.reject(new Error('Rejected')) })),
    );
    const result = await reader.upload(() => Promise.resolve(done));
    expect(result.outcome.kind).toBe('done');
  });

  it('reports a failure when the session cannot be opened', async () => {
    const reader = new DiscReader(() => Promise.reject(new Error('busy')));
    const result = await reader.upload(() => Promise.resolve(done));
    expect(result.outcome).toEqual({ kind: 'failed' });
  });

  it('still reads the disc again when the upload breaks off unexpectedly', async () => {
    const log: string[] = [];
    const reader = new DiscReader(() => Promise.resolve(session(log)));
    const result = await reader.upload(() => Promise.reject(new Error('bug')));
    expect(result.outcome).toEqual({ kind: 'failed' });
    expect(result.result.kind).toBe('disc');
    expect(log).toContain('read');
  });

  it('reopens the session for the read after an upload a device error stopped', async () => {
    const log: string[] = [];
    let opened = 0;
    const reader = new DiscReader(() => {
      opened += 1;
      return Promise.resolve(session(log));
    });
    await reader.upload(() => Promise.resolve({ ...done, failure: new Error('gone') }));
    expect(opened).toBe(2);
  });
});
