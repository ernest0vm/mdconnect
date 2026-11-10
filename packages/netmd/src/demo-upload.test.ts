import { describe, expect, it } from 'vitest';

import { demoDevice } from './demo';
import { NetMdInterface } from './interface';
import { NetMdTransport } from './transport';
import { operatingStateOf, UploadSession } from './upload-session';

describe('the demo device', () => {
  it('accepts an upload, so the upload screens can be tried without hardware', async () => {
    const transport = new NetMdTransport(demoDevice(), { sleep: () => Promise.resolve() });
    await transport.init();
    const md = new NetMdInterface(transport, { sleep: () => Promise.resolve() });
    const session = new UploadSession(md, {
      vendorId: 0x054c,
      productId: 0x00ca,
      operatingState: operatingStateOf(md),
      random: (length) => new Uint8Array(length).fill(7),
      sleep: () => Promise.resolve(),
    });
    await session.open();
    const first = await session.uploadTrack({
      mode: 'lp4',
      data: new Uint8Array(5000),
      title: 'Demo',
    });
    const second = await session.uploadTrack({ mode: 'sp', data: new Uint8Array(3000), title: '' });
    await session.close();
    expect([first, second]).toEqual([60, 61]);
  });
});
