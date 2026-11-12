import { describe, expect, it } from 'vitest';

import { IDENTIFYING_IN_PROGRESS, RECORDING_IN_PROGRESS } from '../disc/deck-busy';
import { editBlocker } from '../disc/editing';
import { playerBlocker } from '../disc/player-view';
import { recordBlocker } from '../recording/record-view';
import { addTracksBlocker } from '../upload/upload-view';
import {
  consentNeeded,
  consentNotice,
  endingNotice,
  identifyBlocker,
  identifyProgressLabel,
  initialRows,
  listeningEstimate,
  methodChoices,
  needsInput,
  newTitleOf,
  resultLabel,
  resultLine,
  rowsToListen,
  searchBlocker,
  titlesToApply,
  withResult,
} from './identify-view';
import { DEFAULT_RECOGNITION_PREFERENCES, withConsent } from './recognition-preferences';

const free = { selected: 2, busy: false, playBlocker: null, deckBusy: null } as const;

describe('identifyBlocker', () => {
  it('is available with tracks selected and the player usable', () => {
    expect(identifyBlocker(free)).toBeNull();
  });

  it('asks to select tracks when none are (song-recognition: "Nothing selected")', () => {
    expect(identifyBlocker({ ...free, selected: 0 })).toBe('Select tracks to identify them.');
  });

  it('says a recording is in progress (song-recognition: "During a recording")', () => {
    expect(identifyBlocker({ ...free, deckBusy: 'recording' })).toBe(RECORDING_IN_PROGRESS);
  });

  it('waits for a change or upload and gives the player reason', () => {
    expect(identifyBlocker({ ...free, busy: true })).toBe(
      'Wait for the current change or upload to finish.',
    );
    expect(identifyBlocker({ ...free, playBlocker: 'Insert a disc to play it.' })).toBe(
      'Insert a disc to play it.',
    );
  });
});

describe('controls while identifying (song-recognition: "Blocked controls")', () => {
  it('say that identification is in progress', () => {
    const deckBusy = 'identifying';
    expect(editBlocker({ writeProtected: false, busy: false, deckBusy })).toBe(
      IDENTIFYING_IN_PROGRESS,
    );
    expect(addTracksBlocker({ writeProtected: false, busy: false, deckBusy })).toBe(
      IDENTIFYING_IN_PROGRESS,
    );
    expect(recordBlocker({ ...free, deckBusy })).toBe(IDENTIFYING_IN_PROGRESS);
    expect(identifyBlocker({ ...free, deckBusy })).toBe(IDENTIFYING_IN_PROGRESS);
    expect(
      playerBlocker({ status: null, reading: false, saving: false, readable: true, deckBusy }),
    ).toBe(IDENTIFYING_IN_PROGRESS);
    expect(IDENTIFYING_IN_PROGRESS).toBe('Wait for identification to finish.');
  });
});

const dawn = { title: 'Dawn', artist: 'Eleni Karaindrou', album: null, year: null };
const tracks = [
  { index: 1, title: 'Two', fullWidthTitle: '', seconds: 200 },
  { index: 6, title: '', fullWidthTitle: '', seconds: 90 },
];

describe('the Identify dialog rows', () => {
  it('start ticked, with the current title as search text (song-recognition: "Untitled track")', () => {
    const rows = initialRows(tracks);
    expect(rows.map((row) => [row.number, row.current, row.ticked, row.searchText])).toEqual([
      [2, 'Two', true, 'Two'],
      [7, 'Untitled', true, ''],
    ]);
    expect(searchBlocker(rows[1]?.searchText ?? '')).toBe('Type a title or an artist to search.');
    expect(searchBlocker('Dawn')).toBeNull();
  });

  it('format the song found, and let an edit replace it (song-recognition: "Edit a new title")', () => {
    const [row] = withResult(initialRows(tracks), 0, { kind: 'found', song: dawn });
    if (row === undefined) throw new Error('no row');
    expect(newTitleOf(row, 'artist-title')).toBe('Eleni Karaindrou - Dawn');
    expect(newTitleOf({ ...row, edited: 'Dawn' }, 'artist-title')).toBe('Dawn');
  });

  it('apply only ticked rows with a new title (song-recognition: "Leave a track out")', () => {
    const rows = withResult(withResult(initialRows(tracks), 0, { kind: 'found', song: dawn }), 1, {
      kind: 'found',
      song: dawn,
    });
    const unticked = rows.map((row) => (row.number === 7 ? { ...row, ticked: false } : row));
    expect(titlesToApply(unticked, 'title')).toEqual([{ index: 1, raw: 'Dawn' }]);
  });

  it('listen again only to ticked tracks still without a title (song-recognition: "Try the rest another way")', () => {
    const rows = withResult(initialRows(tracks), 0, { kind: 'found', song: dawn });
    expect(rowsToListen(rows).map((row) => row.number)).toEqual([7]);
  });

  it('say why a track has no new title', () => {
    const [row] = initialRows(tracks);
    if (row === undefined) throw new Error('no row');
    expect(resultLabel({ ...row, result: { kind: 'not-found' } })).toBe('Not recognised');
    expect(resultLabel({ ...row, result: { kind: 'too-short' } })).toBe('Too short to identify');
    expect(resultLabel({ ...row, result: { kind: 'unreachable' } })).toBe(
      'The service could not be reached',
    );
    expect(resultLabel(row)).toBe('');
  });
});

describe('the methods', () => {
  it('offer Shazam only where it can be used (song-recognition: "Shazam in the web app")', () => {
    expect(methodChoices(false).find((choice) => choice.method === 'shazam')?.blocker).toBe(
      'Shazam works only in the desktop app.',
    );
    expect(methodChoices(true).every((choice) => choice.blocker === null)).toBe(true);
  });

  it('need an audio input only to listen (song-recognition: "Search needs no input")', () => {
    expect(needsInput('shazam')).toBe(true);
    expect(needsInput('acoustid')).toBe(true);
    expect(needsInput('search')).toBe(false);
  });

  it('say how long listening takes', () => {
    expect(listeningEstimate(initialRows(tracks), 'acoustid')).toBe('About 4 minutes.');
    expect(listeningEstimate(initialRows(tracks), 'shazam')).toBe('Up to about 2 minutes.');
  });
});

describe('consent (song-recognition: "First use of AcoustID", "Declined")', () => {
  it('is asked before the first use of each service', () => {
    const none = DEFAULT_RECOGNITION_PREFERENCES;
    expect(consentNeeded(none, 'acoustid')).toBe('acoustid');
    expect(consentNeeded(withConsent(none, 'acoustid'), 'acoustid')).toBeNull();
    expect(consentNeeded(withConsent(none, 'acoustid'), 'search')).toBe('musicbrainz');
  });

  it('says what is sent to whom', () => {
    for (const word of [/fingerprint/u, /length/u, /AcoustID/u]) {
      expect(consentNotice('acoustid').body).toMatch(word);
    }
    expect(consentNotice('shazam').body).toMatch(/unofficial/u);
    for (const word of [/search text/u, /MusicBrainz/u]) {
      expect(consentNotice('musicbrainz').body).toMatch(word);
    }
    for (const service of ['shazam', 'acoustid', 'musicbrainz'] as const) {
      expect(consentNotice(service).body).toMatch(/No audio/u);
    }
  });
});

describe('identifyProgressLabel (song-recognition: "Progress")', () => {
  it('names the track out of how many and what the app is doing', () => {
    expect(
      identifyProgressLabel({ position: 1, total: 3, title: 'Dawn', stage: 'listening' }, 'shazam'),
    ).toBe('Track 2 of 3: “Dawn” — listening');
    expect(
      identifyProgressLabel({ position: 1, total: 3, title: 'Dawn', stage: 'asking' }, 'acoustid'),
    ).toBe('Track 2 of 3: “Dawn” — asking AcoustID');
  });

  it('explains how listening ended early', () => {
    expect(endingNotice('done')).toBeNull();
    expect(endingNotice('cancelled')).toBe(
      'Identification cancelled. The results found so far are kept.',
    );
    expect(endingNotice('disconnected')).toMatch(/disconnected/u);
    expect(endingNotice('input-lost')).toMatch(/input stopped/u);
    expect(endingNotice('refused')).toMatch(/refused/u);
    expect(endingNotice('failed')).toMatch(/unexpected/u);
  });
});

describe('resultLine (song-recognition: "Pick a result")', () => {
  it('shows title, artist, album, year and length', () => {
    expect(
      resultLine({
        id: 'r1',
        song: {
          title: 'Dawn',
          artist: 'Eleni Karaindrou',
          album: 'Eternity and a Day',
          year: '1998',
        },
        seconds: 221,
      }),
    ).toBe('Dawn — Eleni Karaindrou, Eternity and a Day, 1998, 3:41');
    expect(
      resultLine({
        id: 'r2',
        song: { title: 'Dawn', artist: '', album: null, year: null },
        seconds: null,
      }),
    ).toBe('Dawn');
  });
});
