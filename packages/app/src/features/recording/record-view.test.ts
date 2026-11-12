import { describe, expect, it } from 'vitest';

import { addTracksBlocker } from '../upload/upload-view';
import { editBlocker } from '../disc/editing';
import { playerBlocker } from '../disc/player-view';
import {
  chooseInput,
  inputProblem,
  longTrackWarning,
  progressLabel,
  RECORDING_IN_PROGRESS,
  recordBlocker,
  summaryLines,
} from './record-view';
import { InputProcessingError } from './capture';

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

describe('chooseInput (deck-recording: "Remembered input")', () => {
  const inputs = [
    { deviceId: 'default', label: 'Default - Built-in Microphone' },
    { deviceId: 'line', label: 'Line In' },
  ];

  it('chooses the remembered input when it is still there', () => {
    expect(chooseInput(inputs, 'line')).toBe('line');
  });

  it('falls back to the system default input, then the first, or none', () => {
    const phoneFirst = [{ deviceId: 'phone', label: 'iPhone Microphone' }, ...inputs];
    expect(chooseInput(phoneFirst, 'gone')).toBe('default');
    expect(chooseInput(phoneFirst, null)).toBe('default');
    expect(chooseInput([{ deviceId: 'line', label: 'Line In' }], null)).toBe('line');
    expect(chooseInput([], 'line')).toBeNull();
  });
});

describe('inputProblem', () => {
  it('explains a refused permission and how to allow it (deck-recording: "Permission refused")', () => {
    const message = inputProblem(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    expect(message).toMatch(/cannot hear/u);
    expect(message).toMatch(/Privacy/u);
  });

  it('says when there is no input (deck-recording: "No input")', () => {
    expect(inputProblem(Object.assign(new Error('x'), { name: 'NotFoundError' }))).toMatch(
      /no audio input/u,
    );
  });

  it('describes other failures plainly', () => {
    expect(inputProblem(new Error('busy'))).toMatch(/could not be opened/u);
  });

  it('asks for another input when this one cannot turn off its sound processing (deck-recording: "Processing that cannot be turned off")', () => {
    expect(inputProblem(new InputProcessingError())).toMatch(/would change the music/u);
  });
});

describe('progressLabel (deck-recording: "Progress")', () => {
  it('names the track out of how many, with its title', () => {
    expect(progressLabel({ position: 1, total: 3, title: 'Dawn' })).toBe('Track 2 of 3: “Dawn”');
  });
});

describe('summaryLines (deck-recording: "Summary")', () => {
  it('says when the audio input went away', () => {
    expect(
      summaryLines({ saved: ['01 A.wav'], folder: 'MD', clipped: [], ending: 'input-lost' }),
    ).toEqual([
      'The audio input stopped, so recording stopped. 1 file saved to “MD”; the track in progress was not kept. Check the cable or the audio interface, then record the rest again.',
    ]);
  });

  it('says how many files were saved and where', () => {
    expect(
      summaryLines({
        saved: ['01 A.wav', '02 B.wav', '03 C.wav'],
        folder: 'MiniDisc',
        clipped: [],
        ending: 'done',
      }),
    ).toEqual(['3 files saved to “MiniDisc”.']);
  });

  it('says files were downloaded when there was no folder', () => {
    expect(
      summaryLines({ saved: ['01 A.wav'], folder: null, clipped: [], ending: 'done' }),
    ).toEqual(['1 file sent to the browser’s downloads.']);
  });

  it('explains how the recording ended early, and warns about clipping', () => {
    expect(
      summaryLines({
        saved: ['01 A.wav'],
        folder: 'MD',
        clipped: ['01 A.wav'],
        ending: 'cancelled',
      }),
    ).toEqual([
      'Recording cancelled. 1 file saved to “MD”; the track in progress was not kept.',
      'The input was too loud in 01 A.wav. Lower the deck’s volume or the input gain and record it again.',
    ]);
    expect(summaryLines({ saved: [], folder: 'MD', clipped: [], ending: 'refused' })[0]).toMatch(
      /device refused/u,
    );
    expect(
      summaryLines({ saved: ['01 A.wav'], folder: 'MD', clipped: [], ending: 'failed' })[0],
    ).toMatch(/could not be saved/u);
  });
});

describe('longTrackWarning', () => {
  it('warns about tracks longer than an hour', () => {
    expect(longTrackWarning([{ seconds: 3000 }, { seconds: 3700 }])).toMatch(
      /longer than an hour/u,
    );
    expect(longTrackWarning([{ seconds: 3000 }])).toBeNull();
  });
});
