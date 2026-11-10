/*
 * Ported from netmd-js 4.4.1, src/utils.ts (`getHalfWidthTitleLength`, `sanitizeHalfWidthTitle`,
 * `sanitizeFullWidthTitle`, `aggressiveSanitizeTitle`), https://github.com/cybercase/netmd-js,
 * by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - Accents are stripped with Unicode decomposition and a small table instead of the `diacritics`
 *   package (`stripDiacritics`). Rare letters that table does not cover become spaces.
 * - Shift-JIS is encoded with `encodeSjis` instead of `jconv`; a title with a character that has
 *   no code takes the fallback path instead of being encoded with a replacement byte.
 */

import { isSjisEncodable, sjisLength } from './sjis';
import {
  CYRILLIC_TO_LATIN,
  GERMAN_TO_ASCII,
  TO_FULL_WIDTH,
  TO_HALF_WIDTH,
  VOICED_KANA_EXTRA_BYTES,
} from './title-tables';

/** Letters that carry a stroke or ligature instead of a combining accent, so they do not decompose. */
const UNDECOMPOSABLE: Readonly<Record<string, string>> = {
  Ø: 'O',
  ø: 'o',
  Æ: 'AE',
  æ: 'ae',
  Œ: 'OE',
  œ: 'oe',
  Ł: 'L',
  ł: 'l',
  Đ: 'D',
  đ: 'd',
  ß: 'ss',
  Þ: 'Th',
  þ: 'th',
};

/** Removes accents: "Río" becomes "Rio". */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/./gu, (char) => UNDECOMPOSABLE[char] ?? char);
}

/** Keeps only ASCII, the last resort when a title cannot be converted otherwise. */
function aggressiveSanitizeTitle(title: string): string {
  return Array.from(stripDiacritics(title))
    .filter((char) => char.charCodeAt(0) <= 0x7f)
    .join('');
}

/** Bytes a half-width title takes on the disc: voiced kana are stored as two characters. */
export function halfWidthTitleLength(title: string): number {
  let length = 0;
  for (const char of title) length += 1 + (VOICED_KANA_EXTRA_BYTES[char] ?? 0);
  return length;
}

const DAKUTEN_MARKS = new Set(['\u309B', '\u3099', '\uFF9E']);
const HANDAKUTEN_MARKS = new Set(['\u309C', '\u309A', '\uFF9F']);
const HANDAKUTEN_KANA = new Set('はひふへほハヒフヘホ');
const DAKUTEN_KANA = new Set([
  ...Array.from('かきくけこさしすせそたちつてとカキクケコサシスセソタチツテト'),
  ...HANDAKUTEN_KANA,
]);

const shift = (char: string, by: number) => String.fromCharCode(char.charCodeAt(0) + by);

/** Joins a kana followed by a separate (han)dakuten mark into the single voiced kana. */
function joinVoicingMarks(title: string): string {
  const joined: string[] = [];
  let pending: 'none' | 'dakuten' | 'handakuten' = 'none';
  for (const char of Array.from(title).reverse()) {
    if (pending === 'dakuten' && DAKUTEN_KANA.has(char)) {
      joined.push(shift(char, 1));
      pending = 'none';
    } else if (pending === 'handakuten' && HANDAKUTEN_KANA.has(char)) {
      joined.push(shift(char, 2));
      pending = 'none';
    } else if (DAKUTEN_MARKS.has(char)) {
      pending = 'dakuten';
    } else if (HANDAKUTEN_MARKS.has(char)) {
      pending = 'handakuten';
    } else {
      pending = 'none';
      joined.push(char);
    }
  }
  return joined.reverse().join('');
}

const HALF_WIDTH_KANA = new Set(Object.values(TO_HALF_WIDTH));

function toHalfWidth(char: string): string | null {
  const mapped = TO_HALF_WIDTH[char];
  if (mapped) return mapped;
  if (char.charCodeAt(0) < 0x7f || HALF_WIDTH_KANA.has(char)) return char;
  return null;
}

function remapForFullWidth(title: string): string {
  return title.replace(/./gu, (char) => {
    const japanese = TO_FULL_WIDTH[char] ?? char;
    const cyrillic = CYRILLIC_TO_LATIN[japanese] ?? japanese;
    return GERMAN_TO_ASCII[cyrillic] ?? cyrillic;
  });
}

/**
 * Converts a title to what a half-width title field can store: ASCII and half-width katakana.
 * Accented letters lose their accents; anything else becomes a space.
 */
export function sanitizeHalfWidthTitle(input: string): string {
  const title = joinVoicingMarks(remapForFullWidth(input));
  const sanitized = Array.from(title)
    .map((char) => toHalfWidth(char) ?? toHalfWidth(stripDiacritics(char)) ?? ' ')
    .join('');
  // If the bytes do not match the expected length the disc could be corrupted; fall back to ASCII.
  if (sjisLength(sanitized) !== halfWidthTitleLength(title)) return aggressiveSanitizeTitle(title);
  return sanitized;
}

/** Converts a title to what a full-width title field can store: two-byte Shift-JIS characters. */
export function sanitizeFullWidthTitle(title: string): string {
  const remapped = remapForFullWidth(title);
  // Every character of a full-width title takes two bytes.
  if (!isSjisEncodable(remapped) || sjisLength(remapped) !== title.length * 2) {
    return aggressiveSanitizeTitle(title);
  }
  return remapped;
}
