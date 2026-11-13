import { describe, expect, it } from 'vitest';

import { formatTitle } from './title-format';

const dawn = {
  title: 'Dawn',
  artist: 'Eleni Karaindrou',
  album: 'Eternity and a Day',
  year: '1998',
};

describe('formatTitle', () => {
  it('builds each of the five formats (song-recognition: "Artist - Title")', () => {
    expect(formatTitle(dawn, 'title')).toBe('Dawn');
    expect(formatTitle(dawn, 'artist-title')).toBe('Eleni Karaindrou - Dawn');
    expect(formatTitle(dawn, 'title-artist')).toBe('Dawn - Eleni Karaindrou');
    expect(formatTitle(dawn, 'album-title')).toBe('Eternity and a Day - Dawn');
    expect(formatTitle(dawn, 'artist-album-title')).toBe(
      'Eleni Karaindrou - Eternity and a Day - Dawn',
    );
  });

  it('leaves out a part the service did not return (song-recognition: "Album unknown")', () => {
    expect(formatTitle({ ...dawn, album: null }, 'album-title')).toBe('Dawn');
    expect(formatTitle({ ...dawn, artist: '' }, 'artist-album-title')).toBe(
      'Eternity and a Day - Dawn',
    );
  });
});
