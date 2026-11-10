/**
 * Shift-JIS encoding built from the platform's decoder, so no encoding tables ship with the app.
 * netmd-js uses `jconv` for this; see the edit-disc design (decision 2).
 *
 * The table is built on first use by decoding every single-byte and double-byte code. Where
 * several codes decode to the same character, the first one wins, except that the NEC-selected
 * IBM extensions (pointers 8272 to 8835) are skipped, as the WHATWG Shift_JIS encoder does.
 */

const REPLACEMENT = '�';
const NEC_IBM_FIRST = 8272;
const NEC_IBM_LAST = 8835;

let table: Map<string, number> | null = null;

function buildTable(): Map<string, number> {
  const decoder = new TextDecoder('shift_jis');
  const codes = new Map<string, number>();
  const add = (char: string, code: number) => {
    if (char.length !== 1 || char === REPLACEMENT || codes.has(char)) return;
    codes.set(char, code);
  };

  for (let byte = 0; byte <= 0xdf; byte++) {
    if (byte >= 0x81 && byte <= 0x9f) continue;
    add(decoder.decode(Uint8Array.of(byte)), byte);
  }
  for (let lead = 0x81; lead <= 0xfc; lead++) {
    if (lead > 0x9f && lead < 0xe0) continue;
    for (let trail = 0x40; trail <= 0xfc; trail++) {
      if (trail === 0x7f) continue;
      const pointer =
        (lead - (lead < 0xa0 ? 0x81 : 0xc1)) * 188 + trail - (trail < 0x7f ? 0x40 : 0x41);
      if (pointer >= NEC_IBM_FIRST && pointer <= NEC_IBM_LAST) continue;
      add(decoder.decode(Uint8Array.of(lead, trail)), (lead << 8) | trail);
    }
  }
  return codes;
}

function codeOf(char: string): number | undefined {
  table ??= buildTable();
  return table.get(char);
}

/** Whether every character of `text` has a Shift-JIS code. */
export function isSjisEncodable(text: string): boolean {
  for (const char of text) if (codeOf(char) === undefined) return false;
  return true;
}

/** Encodes `text` as Shift-JIS. Throws on a character with no code, so nothing is written silently wrong. */
export function encodeSjis(text: string): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  for (const char of text) {
    const code = codeOf(char);
    if (code === undefined) throw new RangeError(`"${char}" cannot be encoded as Shift-JIS`);
    if (code > 0xff) bytes.push(code >> 8, code & 0xff);
    else bytes.push(code);
  }
  return Uint8Array.from(bytes);
}

/** Length of `text` in Shift-JIS bytes. */
export function sjisLength(text: string): number {
  return encodeSjis(text).length;
}
