import { describe, expect, it } from 'vitest';

import type { Disc } from './content';
import { renameDisc, replaceDiscTitle, rewriteDiscGroups, type DiscTitleWriter } from './commands';

function writer(raw: string, rawFullWidth = '') {
  const titles = { half: raw, full: rawFullWidth };
  const writes: [string, boolean][] = [];
  const md: DiscTitleWriter = {
    getRawDiscTitle: (fullWidth) => Promise.resolve(fullWidth === true ? titles.full : titles.half),
    setDiscTitle: (title, fullWidth) => {
      writes.push([title, fullWidth === true]);
      return Promise.resolve();
    },
  };
  return { md, writes };
}

describe('replaceDiscTitle', () => {
  it('replaces a plain title', () => {
    expect(replaceDiscTitle('Mix', 'Road trip', false)).toBe('Road trip');
  });

  it('keeps the groups (disc-editing: "Rename a grouped disc")', () => {
    expect(replaceDiscTitle('0;Mix//1-2;Side A//', 'Road trip', false)).toBe(
      '0;Road trip//1-2;Side A//',
    );
  });

  it('adds a title to a disc that only has groups', () => {
    expect(replaceDiscTitle('1-2;Side A//', 'Road trip', false)).toBe('0;Road trip//1-2;Side A//');
  });

  it('removes the title entry when the title is cleared (disc-editing: "Clear the disc title")', () => {
    expect(replaceDiscTitle('0;Mix//1-2;Side A//', '', false)).toBe('1-2;Side A//');
    expect(replaceDiscTitle('1-2;Side A//', '', false)).toBe('1-2;Side A//');
  });

  it('replaces a plain title that contains // but has no groups', () => {
    expect(replaceDiscTitle('AC//DC', 'New', false)).toBe('New');
    expect(replaceDiscTitle('Ａ／／Ｂ', '朝', true)).toBe('朝');
  });

  it('uses the full-width markers for full-width titles', () => {
    expect(replaceDiscTitle('０；夜／／１－２；エー／／', '朝', true)).toBe(
      '０；朝／／１－２；エー／／',
    );
  });
});

describe('renameDisc', () => {
  it('writes only the half-width title when no full-width title is given', async () => {
    const { md, writes } = writer('0;Mix//1-2;Side A//');
    await renameDisc(md, 'Road trip');
    expect(writes).toEqual([['0;Road trip//1-2;Side A//', false]]);
  });

  it('writes the full-width title when it changes', async () => {
    const { md, writes } = writer('Mix', '夜');
    await renameDisc(md, 'Mix', '朝');
    expect(writes).toEqual([['朝', true]]);
  });

  it('writes nothing when neither title changes', async () => {
    const { md, writes } = writer('0;Mix//1;A//', '夜');
    await renameDisc(md, 'Mix', '夜');
    expect(writes).toEqual([]);
  });
});

describe('rewriteDiscGroups', () => {
  it('writes the compiled half-width and full-width titles', async () => {
    const { md, writes } = writer('Mix');
    const disc: Disc = {
      title: 'Mix',
      fullWidthTitle: '',
      writable: true,
      writeProtected: false,
      used: 0,
      left: 0,
      total: 0,
      trackCount: 1,
      groups: [
        {
          title: 'A',
          fullWidthTitle: null,
          tracks: [
            {
              index: 0,
              title: '',
              fullWidthTitle: '',
              duration: 0,
              channel: 0,
              encoding: 0x90,
              flags: 0,
            },
          ],
        },
      ],
    };
    await rewriteDiscGroups(md, disc);
    expect(writes).toEqual([
      ['0;Mix//1;A//', false],
      ['', true],
    ]);
  });
});
