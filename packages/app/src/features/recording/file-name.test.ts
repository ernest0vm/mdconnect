import { describe, expect, it } from 'vitest';

import { recordingFileName } from './file-name';

const track = (index: number, title = '', fullWidthTitle = '') => ({
  index,
  title,
  fullWidthTitle,
});

describe('recordingFileName', () => {
  it('names a file from its number and title, replacing refused characters (deck-recording: "File name")', () => {
    expect(recordingFileName(track(2, 'Dawn: Part 1/2'), 12)).toBe('03 Dawn- Part 1-2.wav');
  });

  it('names an untitled track by its number (deck-recording: "Untitled track")', () => {
    expect(recordingFileName(track(6), 12)).toBe('07 Track 07.wav');
  });

  it('adds the full-width title in parentheses', () => {
    expect(recordingFileName(track(0, 'Yoake', '夜明け'), 9)).toBe('01 Yoake (夜明け).wav');
    expect(recordingFileName(track(0, '', '夜明け'), 9)).toBe('01 夜明け.wav');
  });

  it('pads to three digits on a disc of 100 tracks or more', () => {
    expect(recordingFileName(track(4, 'Five'), 120)).toBe('005 Five.wav');
  });

  it('replaces every character Windows refuses and control characters', () => {
    expect(recordingFileName(track(0, 'a\\b*c?d"e<f>g|h\u0007i'), 1)).toBe(
      '01 a-b-c-d-e-f-g-h-i.wav',
    );
  });

  it('trims trailing dots and spaces before the extension, which Windows drops', () => {
    expect(recordingFileName(track(0, 'Wait... '), 1)).toBe('01 Wait.wav');
  });

  it('keeps names under 200 characters', () => {
    const name = recordingFileName(track(0, 'x'.repeat(300)), 1);
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith('.wav')).toBe(true);
  });
});
