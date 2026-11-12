import { describe, expect, it } from 'vitest';

import { isSafeFileName, uniqueFileName } from './file-names';

describe('uniqueFileName (deck-recording: "Name already taken")', () => {
  it('keeps a free name', () => {
    expect(uniqueFileName('03 Dawn.wav', () => false)).toBe('03 Dawn.wav');
  });

  it('adds (2), (3)… before the extension until the name is free', () => {
    const taken = new Set(['03 Dawn.wav', '03 Dawn (2).wav']);
    expect(uniqueFileName('03 Dawn.wav', (name) => taken.has(name))).toBe('03 Dawn (3).wav');
  });

  it('numbers a name without an extension', () => {
    expect(uniqueFileName('notes', (name) => name === 'notes')).toBe('notes (2)');
  });

  it('gives up after many attempts instead of looping forever', () => {
    expect(() => uniqueFileName('a.wav', () => true)).toThrow(/free name/u);
  });
});

describe('isSafeFileName (desktop-shell: "Path in a file name")', () => {
  it('accepts a plain file name', () => {
    expect(isSafeFileName('03 Dawn (2).wav')).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['.', 'dot'],
    ['..', 'parent'],
    ['../evil.wav', 'parent path'],
    ['a/b.wav', 'slash'],
    ['a\\b.wav', 'backslash'],
    ['a\u0000b.wav', 'control character'],
    ['x'.repeat(256), 'too long'],
    ['漢'.repeat(86), 'over 255 bytes in UTF-8'],
    ['a:b.wav', 'colon (an alternate data stream on Windows)'],
    ['a*b?.wav', 'wildcards'],
    ['a<b>c|d".wav', 'other characters Windows refuses'],
  ])('refuses %j (%s)', (name) => {
    expect(isSafeFileName(name)).toBe(false);
  });
});
