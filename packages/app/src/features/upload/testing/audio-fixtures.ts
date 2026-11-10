/**
 * Small audio files built in code, so tests need no binary fixtures. Each holds just enough for a
 * parser: headers, tags and a few bytes of (silent or meaningless) audio.
 */

const ascii = (text: string) => new TextEncoder().encode(text);

function concat(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const u32le = (value: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
};
const u16le = (value: number) => {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
};

/**
 * A FLAC file with a STREAMINFO block (44.1 kHz stereo, `seconds` long) and Vorbis comments.
 * Comments are `KEY=value` strings, such as `TITLE=Intro` or `REPLAYGAIN_TRACK_GAIN=-6.00 dB`.
 */
export function flacFile(comments: readonly string[], seconds = 2): Uint8Array<ArrayBuffer> {
  const streamInfo = new Uint8Array(34);
  const view = new DataView(streamInfo.buffer);
  view.setUint16(0, 4096); // min block size
  view.setUint16(2, 4096); // max block size
  // Bytes 10-17: sample rate (20 bits), channels - 1 (3 bits), bits - 1 (5 bits), samples (36 bits).
  const sampleRate = 44_100;
  const samples = sampleRate * seconds;
  streamInfo[10] = (sampleRate >> 12) & 0xff;
  streamInfo[11] = (sampleRate >> 4) & 0xff;
  streamInfo[12] = ((sampleRate & 0xf) << 4) | (1 << 1) | ((15 >> 4) & 1);
  streamInfo[13] = ((15 & 0xf) << 4) | Math.floor(samples / 2 ** 32);
  view.setUint32(14, samples >>> 0);

  const vendor = ascii('mdconnect');
  const comment = concat(
    u32le(vendor.length),
    vendor,
    u32le(comments.length),
    ...comments.flatMap((text) => {
      const bytes = ascii(text);
      return [u32le(bytes.length), bytes];
    }),
  );
  const blockHeader = (type: number, length: number, last: boolean) =>
    new Uint8Array([(last ? 0x80 : 0) | type, length >> 16, (length >> 8) & 0xff, length & 0xff]);
  return concat(
    ascii('fLaC'),
    blockHeader(0, streamInfo.length, false),
    streamInfo,
    blockHeader(4, comment.length, true),
    comment,
  );
}

/** An MP3 with an ID3v2.3 tag (title, artist, album) and no audio frames. */
export function mp3WithId3(frames: Readonly<Record<string, string>>): Uint8Array<ArrayBuffer> {
  const body = concat(
    ...Object.entries(frames).map(([id, text]) => {
      const value = concat(new Uint8Array([0]), ascii(text));
      const size = new Uint8Array(4);
      new DataView(size.buffer).setUint32(0, value.length);
      return concat(ascii(id), size, new Uint8Array(2), value);
    }),
  );
  const syncSafe = (n: number) =>
    new Uint8Array([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
  return concat(ascii('ID3'), new Uint8Array([3, 0, 0]), syncSafe(body.length), body);
}

/**
 * An ATRAC3 WAV: format 0x0270 (or 0xFFFE), 44.1 kHz stereo, block align of two frames, then a
 * `data` chunk of `dataLength` bytes.
 */
export function atracWav(
  frameSize: number,
  dataLength: number,
  formatTag = 0x0270,
): Uint8Array<ArrayBuffer> {
  const fmt = concat(
    u16le(formatTag),
    u16le(2),
    u32le(44_100),
    u32le(frameSize * 2 * 44_100), // byte rate, not used
    u16le(frameSize * 2),
    u16le(0),
    new Uint8Array(14), // ATRAC3 extra data
  );
  const data = new Uint8Array(dataLength).fill(0xab);
  const chunks = concat(
    ascii('WAVE'),
    ascii('fmt '),
    u32le(fmt.length),
    fmt,
    ascii('fact'),
    u32le(8),
    new Uint8Array(8),
    ascii('data'),
    u32le(data.length),
    data,
  );
  return concat(ascii('RIFF'), u32le(chunks.length), chunks);
}

/**
 * An OMA (EA3) file holding ATRAC3 at `frameSize` bytes per frame pair, with `jointStereo` set as
 * Sony sets it for LP4, preceded by an `ea3` tag block.
 */
export function omaFile(options: {
  readonly frameSize: number;
  readonly jointStereo: boolean;
  readonly encrypted?: boolean;
  readonly dataLength?: number;
}): Uint8Array<ArrayBuffer> {
  // 'ea3', version (2 bytes), flags, then a sync-safe size of 16.
  const tag = concat(ascii('ea3'), new Uint8Array([3, 0, 0, 0, 0, 0, 0x10]), new Uint8Array(16));
  const header = new Uint8Array(96);
  header.set(ascii('EA3\x01'), 0);
  header[5] = 96;
  const encryption = options.encrypted === true ? 0x0001 : 0xffff;
  header[6] = encryption >> 8;
  header[7] = encryption & 0xff;
  header[32] = 0; // ATRAC3
  // Sample rate index 1 (44.1 kHz) in bits 13-15, joint stereo in bit 17, frame size / 8 below.
  const info = (1 << 13) | ((options.jointStereo ? 1 : 0) << 17) | (options.frameSize / 8);
  header[33] = (info >> 16) & 0xff;
  header[34] = (info >> 8) & 0xff;
  header[35] = info & 0xff;
  return concat(tag, header, new Uint8Array(options.dataLength ?? 384).fill(0xcd));
}
