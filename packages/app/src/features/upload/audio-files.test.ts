import { describe, expect, it } from 'vitest';

import { readAtracFile } from './atrac-file';
import { readTags } from './tags';
import { atracWav, flacFile, mp3WithId3, omaFile } from './testing/audio-fixtures';
import { titleFromSource, type TitleSource } from './title-source';

const blob = (data: Uint8Array<ArrayBuffer>, type = '') => new Blob([data], { type });

describe('readTags', () => {
  it('reads title, artist, album, duration and track gain from a FLAC file', async () => {
    const tags = await readTags(
      blob(
        flacFile(
          [
            'TITLE=Know Your Chicken',
            'ARTIST=Cibo Matto',
            'ALBUM=Viva! La Woman',
            'REPLAYGAIN_TRACK_GAIN=-6.00 dB',
          ],
          3,
        ),
      ),
    );
    expect(tags).toEqual({
      title: 'Know Your Chicken',
      artist: 'Cibo Matto',
      album: 'Viva! La Woman',
      durationSeconds: 3,
      trackGainDb: -6,
    });
  });

  it('reads ID3 tags from an MP3', async () => {
    const tags = await readTags(
      blob(mp3WithId3({ TIT2: 'Intro', TPE1: 'Band', TALB: 'Debut' }), 'audio/mpeg'),
    );
    expect(tags).toMatchObject({ title: 'Intro', artist: 'Band', album: 'Debut' });
  });

  it('returns no tags for a file it cannot read', async () => {
    expect(await readTags(blob(new Uint8Array([1, 2, 3])))).toEqual({});
  });
});

describe('titleFromSource', () => {
  const tags = { title: 'Know Your Chicken', artist: 'Cibo Matto', album: 'Viva! La Woman' };

  it('uses the file name without its extension (track-upload: "Title from file name")', () => {
    expect(titleFromSource('file', tags, '01 Intro.mp3')).toBe('01 Intro');
  });

  it.each<[TitleSource, string]>([
    ['title', 'Know Your Chicken'],
    ['album-title', 'Viva! La Woman - Know Your Chicken'],
    ['artist-title', 'Cibo Matto - Know Your Chicken'],
    ['title-artist', 'Know Your Chicken - Cibo Matto'],
    ['artist-album-title', 'Cibo Matto - Viva! La Woman - Know Your Chicken'],
  ])('builds %s from tags (track-upload: "Title from tags")', (source, expected) => {
    expect(titleFromSource(source, tags, 'track.mp3')).toBe(expected);
  });

  it('falls back to the file name when a needed tag is missing (track-upload: "Missing tag")', () => {
    expect(titleFromSource('artist-title', {}, 'demo.wav')).toBe('demo');
    expect(titleFromSource('artist-title', { title: 'Only title' }, 'demo.wav')).toBe('demo');
  });

  it('keeps a file name without an extension, or one that starts with a dot', () => {
    expect(titleFromSource('file', {}, 'README')).toBe('README');
    expect(titleFromSource('file', {}, '.hidden')).toBe('.hidden');
  });

  it('ignores blank tags', () => {
    expect(titleFromSource('title', { title: '   ' }, 'demo.wav')).toBe('demo');
  });
});

describe('readAtracFile', () => {
  it.each([
    [192, 'lp2'],
    [152, 'lp105'],
    [96, 'lp4'],
  ] as const)(
    'recognises a %i-byte-frame ATRAC3 WAV as %s (audio-conversion: "LP4 ATRAC3 WAV", "LP105 file")',
    (frameSize, mode) => {
      const file = atracWav(frameSize, frameSize * 4);
      const result = readAtracFile(file);
      expect(result).toMatchObject({ kind: 'atrac', mode });
      if (result?.kind !== 'atrac') return;
      expect(result.data).toHaveLength(frameSize * 4);
      expect(result.data.every((b) => b === 0xab)).toBe(true);
    },
  );

  it('recognises the extensible WAV format', () => {
    expect(readAtracFile(atracWav(96, 96, 0xfffe))).toMatchObject({ kind: 'atrac', mode: 'lp4' });
  });

  it('ignores a WAV with another frame size', () => {
    expect(readAtracFile(atracWav(100, 100))).toBeNull();
  });

  it('ignores a PCM WAV, an MP3 and a short file', () => {
    const pcm = atracWav(192, 192, 0x0001);
    expect(readAtracFile(pcm)).toBeNull();
    expect(readAtracFile(mp3WithId3({ TIT2: 'x' }))).toBeNull();
    expect(readAtracFile(new Uint8Array(10))).toBeNull();
  });

  it.each([
    [384, false, 'lp2'],
    [304, false, 'lp105'],
    [192, true, 'lp4'],
  ] as const)(
    'recognises an OMA with %i-byte frames (joint stereo: %s) as %s',
    (frameSize, jointStereo, mode) => {
      const result = readAtracFile(omaFile({ frameSize, jointStereo, dataLength: 768 }));
      expect(result).toMatchObject({ kind: 'atrac', mode });
      if (result?.kind !== 'atrac') return;
      expect(result.data).toHaveLength(768);
    },
  );

  it('reports an encrypted OMA (audio-conversion: "Encrypted OMA")', () => {
    expect(readAtracFile(omaFile({ frameSize: 384, jointStereo: false, encrypted: true }))).toEqual(
      {
        kind: 'encrypted',
      },
    );
  });

  it('reports an OMA in a format NetMD cannot take as unsupported', () => {
    expect(readAtracFile(omaFile({ frameSize: 384, jointStereo: true }))).toEqual({
      kind: 'unsupported',
    });
  });
});
