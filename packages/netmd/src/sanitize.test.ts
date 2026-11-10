import { describe, expect, it } from 'vitest';

import {
  halfWidthTitleLength,
  sanitizeFullWidthTitle,
  sanitizeHalfWidthTitle,
  stripDiacritics,
} from './sanitize';

describe('stripDiacritics', () => {
  it('removes accents that decompose', () => {
    expect(stripDiacritics('Te Lloré un Río, Çà, Ñandú')).toBe('Te Llore un Rio, Ca, Nandu');
  });

  it('maps letters that do not decompose', () => {
    expect(stripDiacritics('Øresund Æsir Œuvre Łódź straße Þór Đorđe')).toBe(
      'Oresund AEsir OEuvre Lodz strasse Thor Dorde',
    );
  });
});

describe('sanitizeHalfWidthTitle', () => {
  it('keeps ASCII (disc-editing: "Accented title")', () => {
    expect(sanitizeHalfWidthTitle('Te Lloré un Río')).toBe('Te Llore un Rio');
  });

  it('replaces characters the disc cannot store with spaces (disc-editing: "Unsupported character")', () => {
    expect(sanitizeHalfWidthTitle('A★B')).toBe('A B');
  });

  it('converts full-width letters and kana to half-width', () => {
    expect(sanitizeHalfWidthTitle('ＡＢＣ　カタカナ')).toBe('ABC ｶﾀｶﾅ');
  });

  it('turns voiced kana into a base kana plus a dakuten mark', () => {
    expect(sanitizeHalfWidthTitle('ガギ')).toBe('ｶﾞｷﾞ');
    expect(sanitizeHalfWidthTitle('パ')).toBe('ﾊﾟ');
    // A combining dakuten after a kana joins it first.
    expect(sanitizeHalfWidthTitle('が')).toBe('ｶﾞ');
  });
});

describe('halfWidthTitleLength', () => {
  it('counts voiced kana as two bytes', () => {
    expect(halfWidthTitleLength('abc')).toBe(3);
    expect(halfWidthTitleLength('ガa')).toBe(3);
  });
});

describe('sanitizeFullWidthTitle', () => {
  it('converts ASCII to full-width', () => {
    expect(sanitizeFullWidthTitle('AB 1')).toBe('ＡＢ　１');
  });

  it('keeps kanji and kana', () => {
    expect(sanitizeFullWidthTitle('夜明け')).toBe('夜明け');
  });

  it('drops a whole full-width title to ASCII when one character cannot be stored (disc-editing: "Full-width title with an unsupported character")', () => {
    expect(sanitizeFullWidthTitle('夜明け😀')).toBe('');
  });

  it('falls back to plain ASCII when the title cannot be stored in full-width', () => {
    expect(sanitizeFullWidthTitle('Ríos 😀')).toBe('Rios ');
  });
});
