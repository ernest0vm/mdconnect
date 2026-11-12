import { describe, expect, it } from 'vitest';

import { addTracksBlocker } from '../upload/upload-view';
import { editBlocker } from '../disc/editing';
import { playerBlocker } from '../disc/player-view';
import { RECORDING_IN_PROGRESS, recordBlocker } from './record-view';

const free = { selected: 2, busy: false, playBlocker: null, recording: false } as const;

describe('recordBlocker', () => {
  it('is available with tracks selected and the player usable', () => {
    expect(recordBlocker(free)).toBeNull();
  });

  it('asks to select tracks when none are (deck-recording: "Nothing selected")', () => {
    expect(recordBlocker({ ...free, selected: 0 })).toBe('Select tracks to record them.');
  });

  it('does not depend on write protection (deck-recording: "Write-protected disc")', () => {
    // There is no write-protection input at all: recording only reads the disc.
    expect(Object.keys(free)).not.toContain('writeProtected');
  });

  it('waits for a change or upload, and gives the player reason when it cannot play', () => {
    expect(recordBlocker({ ...free, busy: true })).toBe(
      'Wait for the current change or upload to finish.',
    );
    expect(recordBlocker({ ...free, playBlocker: 'Insert a disc to play it.' })).toBe(
      'Insert a disc to play it.',
    );
  });

  it('is unavailable during a recording', () => {
    expect(recordBlocker({ ...free, recording: true })).toBe(RECORDING_IN_PROGRESS);
  });
});

describe('controls during a recording (deck-recording: "Controls blocked")', () => {
  it('say that a recording is in progress, before any other reason', () => {
    expect(editBlocker({ writeProtected: true, busy: true, recording: true })).toBe(
      RECORDING_IN_PROGRESS,
    );
    expect(addTracksBlocker({ writeProtected: false, busy: false, recording: true })).toBe(
      RECORDING_IN_PROGRESS,
    );
    expect(
      playerBlocker({
        status: null,
        reading: false,
        saving: false,
        readable: true,
        recording: true,
      }),
    ).toBe(RECORDING_IN_PROGRESS);
  });
});
