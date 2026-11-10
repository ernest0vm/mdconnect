import type { Disc } from '@mdconnect/netmd';
import { describe, expect, it } from 'vitest';

import { discStatus } from './disc-status';

describe('discStatus', () => {
  it('shows a reading state with no action', () => {
    expect(discStatus('reading')).toEqual({ kind: 'reading', title: 'Reading disc…' });
  });

  it('says no disc is inserted and offers Refresh (disc-contents: "No disc inserted")', () => {
    expect(discStatus({ kind: 'no-disc' })).toEqual({
      kind: 'notice',
      title: 'No disc inserted',
      message: 'Insert a MiniDisc, then refresh.',
      action: 'Refresh',
    });
  });

  it('explains a failed read and offers Retry, never a raw error (disc-contents: "Command fails")', () => {
    const status = discStatus({ kind: 'failed', reason: 'read-failed' });
    expect(status).toMatchObject({
      kind: 'warning',
      title: 'Could not read the disc',
      action: 'Retry',
    });
  });

  it('explains Hi-MD mode and suggests NetMD mode (disc-contents: "Device in Hi-MD mode")', () => {
    const status = discStatus({ kind: 'failed', reason: 'not-netmd' });
    expect(status).toMatchObject({ kind: 'warning', action: 'Retry' });
    expect(status.kind === 'warning' && status.message).toMatch(/Hi-MD mode yet/);
    expect(status.kind === 'warning' && status.message).toMatch(/NetMD mode/);
  });

  it('explains a device another app or tab is using, with Retry (disc-contents: "Device in use")', () => {
    const status = discStatus({ kind: 'failed', reason: 'unavailable' });
    expect(status).toMatchObject({ kind: 'warning', title: 'Device in use', action: 'Retry' });
    expect(status.kind === 'warning' && status.message).toMatch(/another app or browser tab/);
  });

  it('passes a read disc through, with the disc as read for editing', () => {
    const raw: Disc = {
      title: '',
      fullWidthTitle: '',
      writable: true,
      writeProtected: false,
      used: 0,
      left: 0,
      total: 0,
      trackCount: 0,
      groups: [],
    };
    const disc = {
      title: null,
      subtitle: null,
      writeProtected: false,
      capacity: { used: '0:00', free: '80:00', total: '80:00' },
      capacityMeter: { value: 0, max: 4800, text: '0:00 used of 80:00' },
      groups: [],
    };
    expect(discStatus({ kind: 'disc', disc, raw })).toEqual({ kind: 'disc', disc, raw });
  });
});
