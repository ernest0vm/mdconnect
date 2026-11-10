import { describe, expect, it } from 'vitest';

import { ignoredTracksNote, menuAvailability } from './menu-view';

describe('menuAvailability (app-menu: "Unavailable item"; disc-editing: "Write-protected disc")', () => {
  it('offers everything for a writable disc', () => {
    const items = menuAvailability({ discRead: true, writeProtected: false, busy: false });
    expect(Object.values(items).every((item) => item === null)).toBe(true);
  });

  it('keeps export but blocks import and wipe on a write-protected disc', () => {
    const items = menuAvailability({ discRead: true, writeProtected: true, busy: false });
    expect(items.export).toBeNull();
    expect(items.import).toBe('The disc is write-protected.');
    expect(items.wipe).toBe('The disc is write-protected.');
  });

  it('blocks disc actions while a change is saving or no disc was read', () => {
    expect(menuAvailability({ discRead: true, writeProtected: false, busy: true }).wipe).toBe(
      'Wait for the current change to finish.',
    );
    const none = menuAvailability({ discRead: false, writeProtected: false, busy: false });
    expect(none.export).toBe('No disc has been read.');
    expect(none.about).toBeNull();
    expect(none.exit).toBeNull();
  });
});

describe('ignoredTracksNote (disc-csv: "Different track count")', () => {
  it('names the rows of the file past the end of the disc', () => {
    expect(ignoredTracksNote([11, 12])).toBe('Tracks 11 and 12 of the file will be ignored.');
    expect(ignoredTracksNote([11, 12, 13])).toBe(
      'Tracks 11, 12 and 13 of the file will be ignored.',
    );
  });

  it('uses the singular for one row and says nothing when none is ignored', () => {
    expect(ignoredTracksNote([99])).toBe('Track 99 of the file will be ignored.');
    expect(ignoredTracksNote([])).toBe('');
  });
});
