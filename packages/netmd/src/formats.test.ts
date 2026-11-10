import { describe, expect, it } from 'vitest';

import { UPLOAD_FORMATS, type UploadMode } from './formats';

describe('UPLOAD_FORMATS', () => {
  it.each<[UploadMode, number, number, number]>([
    ['sp', 0x00, 0x06, 2048],
    ['spMono', 0x00, 0x04, 2048],
    ['lp2', 0x94, 0x02, 192],
    // A 105 kbps file keeps its own wire format and is stored as LP2 (audio-conversion: "LP105 file").
    ['lp105', 0x90, 0x02, 152],
    ['lp4', 0xa8, 0x00, 96],
  ])('maps %s to wire format %i, disc format %i and %i-byte frames', (mode, wire, disc, frame) => {
    expect(UPLOAD_FORMATS[mode]).toEqual({ wireFormat: wire, discFormat: disc, frameSize: frame });
  });
});
