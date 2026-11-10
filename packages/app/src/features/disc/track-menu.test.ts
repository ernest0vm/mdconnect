import { describe, expect, it } from 'vitest';

import { trackActions, trackAfterAction } from './track-menu';

const base = {
  trackCount: 5,
  editBlocker: null,
  playBlocker: null,
  playState: 'none' as const,
};

const byId = (track: number, state: Parameters<typeof trackActions>[1]) =>
  Object.fromEntries(trackActions(track, state).map((item) => [item.id, item]));

describe('trackActions', () => {
  it('offers Play, Rename, Delete, Move up and Move down, in that order (track-context-menu: "Track actions")', () => {
    expect(trackActions(2, base).map((item) => [item.id, item.label, item.reason])).toEqual([
      ['play', 'Play', null],
      ['rename', 'Rename', null],
      ['delete', 'Delete', null],
      ['move-up', 'Move up', null],
      ['move-down', 'Move down', null],
    ]);
  });

  it('offers Pause first for the playing track (track-context-menu: "Pause a playing track")', () => {
    expect(trackActions(2, { ...base, playState: 'playing' })[0]).toEqual({
      id: 'play',
      label: 'Pause',
      reason: null,
    });
    expect(trackActions(2, { ...base, playState: 'paused' })[0]?.label).toBe('Play');
  });

  it('blocks editing with the reason and keeps Play (track-context-menu: "Write-protected disc")', () => {
    const items = byId(2, { ...base, editBlocker: 'The disc is write-protected.' });
    for (const id of ['rename', 'delete', 'move-up', 'move-down']) {
      expect(items[id]?.reason).toBe('The disc is write-protected.');
    }
    expect(items.play?.reason).toBeNull();
  });

  it('cannot move the first track up or the last down (track-context-menu: "First track")', () => {
    expect(byId(0, base)['move-up']?.reason).toBe('This is the first track.');
    expect(byId(0, base)['move-down']?.reason).toBeNull();
    expect(byId(4, base)['move-down']?.reason).toBe('This is the last track.');
  });

  it('blocks Play with the player reason', () => {
    const items = byId(2, { ...base, playBlocker: 'Insert a disc to play it.' });
    expect(items.play?.reason).toBe('Insert a disc to play it.');
    expect(items.rename?.reason).toBeNull();
  });
});

describe('trackAfterAction', () => {
  it('keeps focus on the moved track, and on the same track otherwise', () => {
    expect(trackAfterAction(4, 'move-up')).toBe(3);
    expect(trackAfterAction(4, 'move-down')).toBe(5);
    expect(trackAfterAction(4, 'rename')).toBe(4);
    expect(trackAfterAction(4, 'play')).toBe(4);
  });
});
