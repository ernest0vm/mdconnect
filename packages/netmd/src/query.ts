/*
 * Ported from netmd-js 4.4.1, src/query-utils.ts
 * (https://github.com/cybercase/netmd-js), by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream:
 * - Native `BigInt` instead of `jsbi`.
 * - `%W` encodes a full 2-byte BCD word; upstream limits it to one byte.
 * - Debug logging removed.
 * - A length-prefixed block (`%x`, `%s`, `%z`) shorter than its declared length is an error;
 *   upstream returns the bytes that are there.
 *
 * Format language, shared by `formatQuery` and `scanQuery`:
 *   hex digit pairs   literal bytes (spaces are ignored)
 *   %b %w %d %q       1, 2, 4, 8-byte numbers, big-endian; `%<` makes the next one little-endian
 *   %x                bytes preceded by a 2-byte length
 *   %s                like %x, plus a trailing 0 counted in the length
 *   %z                bytes preceded by a 1-byte length
 *   %*                raw bytes (scan: the rest of the input)
 *   %B %W             1 or 2-byte BCD number
 *   %?                (scan only) skip one byte
 */

const NUMBER_WIDTHS: Readonly<Record<string, number>> = { b: 1, w: 2, d: 4, q: 8 };

export type QueryArgument = number | bigint | Uint8Array;
export type ScannedValue = bigint | number | Uint8Array;

function fail(message: string): never {
  throw new Error(message);
}

export function intToBcd(value: number, length = 1): number {
  if (length > 4) fail('Unsupported BCD length. Max allowed is 4');
  if (value > 10 ** (length * 2) - 1)
    fail(`Value ${String(value)} cannot fit in ${String(length)} bytes in BCD`);
  let bcd = 0;
  let nibble = 0;
  let rest = value;
  while (rest > 0) {
    bcd |= (rest % 10) << (4 * nibble);
    rest = Math.floor(rest / 10);
    nibble += 1;
  }
  return bcd;
}

export function bcdToInt(bcd: number): number {
  let value = 0;
  let nibble = 0;
  let rest = bcd;
  while (rest !== 0) {
    value += (rest & 0xf) * 10 ** nibble;
    rest = rest >>> 4;
    nibble += 1;
  }
  return value;
}

function asBytes(value: QueryArgument | undefined): Uint8Array {
  return value instanceof Uint8Array ? value : fail('Expected a byte array argument');
}

function asBigInt(value: QueryArgument | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return fail('Expected a numeric argument');
}

/** Builds a NetMD command from a format string and its arguments. */
export function formatQuery(format: string, ...args: QueryArgument[]): Uint8Array<ArrayBuffer> {
  const result: number[] = [];
  const queue = [...args];
  let half: string | null = null;
  let littleEndian = false;
  let escaped = false;

  for (const char of format) {
    if (escaped) {
      if (!littleEndian && char === '<') {
        littleEndian = true;
        continue;
      }
      if (char === '>') continue;
      escaped = false;
      const value = queue.shift();
      const width = NUMBER_WIDTHS[char];
      if (width !== undefined) {
        const number = asBigInt(value);
        for (let byte = width - 1; byte >= 0; byte--) {
          const shift = littleEndian ? width - 1 - byte : byte;
          result.push(Number((number >> BigInt(shift * 8)) & 0xffn));
        }
        littleEndian = false;
      } else if (char === 'x' || char === 's' || char === 'z') {
        const bytes = asBytes(value);
        const length = bytes.byteLength + (char === 's' ? 1 : 0);
        if (char !== 'z') result.push((length >> 8) & 0xff);
        result.push(length & 0xff, ...bytes);
        if (char === 's') result.push(0);
      } else if (char === '*') {
        result.push(...asBytes(value));
      } else if (char === 'B' || char === 'W') {
        const bcd = intToBcd(Number(asBigInt(value)), char === 'W' ? 2 : 1);
        if (char === 'W') result.push((bcd >> 8) & 0xff);
        result.push(bcd & 0xff);
      } else {
        fail(`Unrecognized format char ${char}`);
      }
      continue;
    }
    if (char === '%') {
      if (half !== null) fail('Format has an odd number of hex digits before %');
      escaped = true;
    } else if (char !== ' ') {
      if (half === null) {
        half = char;
      } else {
        result.push(Number.parseInt(half + char, 16));
        half = null;
      }
    }
  }
  return new Uint8Array(result);
}

/** Reads a NetMD reply against a format string; literal bytes must match exactly. */
export function scanQuery(reply: Uint8Array, format: string): ScannedValue[] {
  const result: ScannedValue[] = [];
  const input = [...reply];
  const take = (): number => input.shift() ?? fail('Reply is shorter than its format');
  let half: string | null = null;
  let littleEndian = false;
  let escaped = false;

  for (const char of format) {
    if (escaped) {
      if (!littleEndian && char === '<') {
        littleEndian = true;
        continue;
      }
      if (char === '>') continue;
      escaped = false;
      const width = NUMBER_WIDTHS[char];
      if (char === '?') {
        take();
      } else if (width !== undefined) {
        let value = 0n;
        for (let byte = width - 1; byte >= 0; byte--) {
          const shift = littleEndian ? width - 1 - byte : byte;
          value |= BigInt(take()) << BigInt(shift * 8);
        }
        littleEndian = false;
        result.push(value);
      } else if (char === 's' || char === 'x' || char === 'z') {
        const length = char === 'z' ? take() : (take() << 8) | take();
        if (input.length < length) fail('Reply is shorter than its format');
        result.push(new Uint8Array(input.splice(0, length)));
      } else if (char === '*' || char === '#') {
        result.push(new Uint8Array(input.splice(0)));
      } else if (char === 'B') {
        result.push(bcdToInt(take()));
      } else if (char === 'W') {
        result.push(bcdToInt((take() << 8) | take()));
      } else {
        fail(`Unrecognized format char ${char}`);
      }
      continue;
    }
    if (char === '%') {
      if (half !== null) fail('Format has an odd number of hex digits before %');
      escaped = true;
    } else if (char !== ' ') {
      if (half === null) {
        half = char;
      } else {
        const position = reply.length - input.length;
        const actual = take();
        const expected = Number.parseInt(half + char, 16);
        if (actual !== expected) {
          fail(
            `Format and input mismatch at ${String(position)}: expected ${String(expected)}, got ${String(actual)} (format ${format})`,
          );
        }
        half = null;
      }
    }
  }
  if (input.length > 0) fail(`${String(input.length)} bytes remaining to parse`);
  return result;
}
