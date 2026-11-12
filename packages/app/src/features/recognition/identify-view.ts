import { FRAMES_PER_SECOND } from '@mdconnect/netmd';

import { type DeckBusy, deckBusyReason } from '../disc/deck-busy';
import { formatDuration } from '../disc/disc-view';
import { progressLabel } from '../recording/record-view';
import type { RecordingTrack } from '../recording/session';
import type { NewTitle } from './apply-titles';
import type { SearchResult } from './musicbrainz';
import {
  acoustIdPlan,
  shazamPlan,
  type IdentifyEnding,
  type IdentifyProgress,
  type TrackResult,
} from './identify-session';
import {
  SERVICE_NAMES,
  SERVICE_OF,
  type IdentifyMethod,
  type RecognitionPreferences,
  type RecognitionService,
} from './recognition-preferences';
import { formatTitle, type TitleFormat } from './title-format';

/**
 * Why Identify is unavailable, or null. Identifying only reads the disc, so a write-protected
 * disc does not block it.
 */
export function identifyBlocker(state: {
  readonly selected: number;
  readonly busy: boolean;
  readonly playBlocker: string | null;
  readonly deckBusy: DeckBusy;
}): string | null {
  const deckReason = deckBusyReason(state.deckBusy);
  if (deckReason !== null) return deckReason;
  if (state.busy) return 'Wait for the current change or upload to finish.';
  if (state.playBlocker !== null) return state.playBlocker;
  if (state.selected === 0) return 'Select tracks to identify them.';
  return null;
}

/** One selected track in the Identify dialog. */
export interface IdentifyRow {
  /** Zero-based track index. */
  readonly index: number;
  /** One-based track number, as shown. */
  readonly number: number;
  /** The current title, as shown. */
  readonly current: string;
  readonly seconds: number;
  readonly ticked: boolean;
  readonly result: TrackResult;
  /** A title the user typed, which replaces the formatted one; null when not edited. */
  readonly edited: string | null;
  /** What Search by name looks for. */
  readonly searchText: string;
}

/** The selected tracks as rows: ticked, not yet identified, searched by their current title. */
export function initialRows(tracks: readonly RecordingTrack[]): IdentifyRow[] {
  return tracks.map((track) => {
    // The full-width title first, as the disc view shows it.
    const title = track.fullWidthTitle || track.title;
    return {
      index: track.index,
      number: track.index + 1,
      current: title === '' ? 'Untitled' : title,
      seconds: track.seconds,
      ticked: true,
      result: { kind: 'none' },
      edited: null,
      searchText: title,
    };
  });
}

/** The rows with one row's result replaced; a new result drops an earlier edit. */
export function withResult(
  rows: readonly IdentifyRow[],
  position: number,
  result: TrackResult,
): IdentifyRow[] {
  return rows.map((row, at) => (at === position ? { ...row, result, edited: null } : row));
}

/**
 * The new title of a row: the edited one, else the song found in the chosen format, else null. An
 * edit cleared to nothing means no new title, so the track keeps its own.
 */
export function newTitleOf(row: IdentifyRow, format: TitleFormat): string | null {
  if (row.edited !== null) return row.edited.trim() === '' ? null : row.edited;
  return row.result.kind === 'found' ? formatTitle(row.result.song, format) : null;
}

/** Why a row has no new title, or empty when it has one or was not tried. */
export function resultLabel(row: IdentifyRow): string {
  switch (row.result.kind) {
    case 'not-found':
      return 'Not recognised';
    case 'too-short':
      return 'Too short to identify';
    case 'unreachable':
      return 'The service could not be reached';
    case 'found':
    case 'none':
      return '';
  }
}

/** The ticked rows still without a new title, which the next listen is for. */
export function rowsToListen(rows: readonly IdentifyRow[]): IdentifyRow[] {
  return rows.filter(
    (row) => row.ticked && (row.edited ?? '').trim() === '' && row.result.kind !== 'found',
  );
}

/** The ticked rows' new titles, to convert and apply. */
export function titlesToApply(rows: readonly IdentifyRow[], format: TitleFormat): NewTitle[] {
  return rows.flatMap((row) => {
    const raw = row.ticked ? newTitleOf(row, format) : null;
    return raw === null ? [] : [{ index: row.index, raw }];
  });
}

/** Why Search cannot run for this text, or null. */
export function searchBlocker(text: string): string | null {
  return text.trim() === '' ? 'Type a title or an artist to search.' : null;
}

export const METHOD_LABELS: Readonly<Record<IdentifyMethod, string>> = {
  shazam: 'Shazam',
  acoustid: 'AcoustID',
  search: 'Search by name',
};

/** The three methods, each with why it is unavailable or null. */
export function methodChoices(
  shazamAvailable: boolean,
): { readonly method: IdentifyMethod; readonly label: string; readonly blocker: string | null }[] {
  return (['shazam', 'acoustid', 'search'] as const).map((method) => ({
    method,
    label: METHOD_LABELS[method],
    blocker:
      method === 'shazam' && !shazamAvailable ? 'Shazam works only in the desktop app.' : null,
  }));
}

/** Whether the method listens to the deck, and so needs an audio input. */
export const needsInput = (method: IdentifyMethod): boolean => method !== 'search';

/** How long listening to these rows takes at most, for the dialog to say before it starts. */
export function listeningEstimate(rows: readonly IdentifyRow[], method: IdentifyMethod): string {
  const plan = method === 'acoustid' ? acoustIdPlan : shazamPlan;
  const seconds = rows.reduce((total, row) => {
    const excerpts = plan(row.seconds);
    return excerpts === 'too-short' ? total : total + excerpts.excerptSeconds * excerpts.attempts;
  }, 0);
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const amount = `${String(minutes)} minute${minutes === 1 ? '' : 's'}.`;
  return method === 'acoustid' ? `About ${amount}` : `Up to about ${amount}`;
}

/** The service a method needs consent for, or null when the user already agreed. */
export function consentNeeded(
  preferences: RecognitionPreferences,
  method: IdentifyMethod,
): RecognitionService | null {
  const service = SERVICE_OF[method];
  return preferences.consent[service] ? null : service;
}

/** What the consent notice says for a service. */
export function consentNotice(service: RecognitionService): { title: string; body: string } {
  const title = `Send data to ${SERVICE_NAMES[service]}?`;
  switch (service) {
    case 'shazam':
      return {
        title,
        body: 'mdconnect sends Shazam a signature of each 12-second excerpt it listens to, made on this computer, and its length. Shazam’s service is unofficial: it may stop answering at any time. No audio is sent.',
      };
    case 'acoustid':
      return {
        title,
        body: 'mdconnect sends AcoustID (acoustid.org) a fingerprint of the audio it listens to, made on this computer, and each track’s length. No audio is sent.',
      };
    case 'musicbrainz':
      return {
        title,
        body: 'mdconnect sends MusicBrainz (musicbrainz.org) the search text you type, and nothing else. No audio is sent.',
      };
  }
}

/** The progress line: the track out of how many, and whether the app listens or asks. */
export function identifyProgressLabel(progress: IdentifyProgress, method: IdentifyMethod): string {
  const doing = progress.stage === 'listening' ? 'listening' : `asking ${METHOD_LABELS[method]}`;
  return `${progressLabel(progress)} — ${doing}`;
}

/** What to say when listening ended before every track was tried, or null. */
export function endingNotice(ending: IdentifyEnding): string | null {
  switch (ending) {
    case 'done':
      return null;
    case 'cancelled':
      return 'Identification cancelled. The results found so far are kept.';
    case 'disconnected':
      return 'The device was disconnected, so identification stopped.';
    case 'input-lost':
      return 'The audio input stopped, so identification stopped. Check the cable or the audio interface, then try the rest again.';
    case 'refused':
      return 'The device refused a playback command, so identification stopped.';
    case 'failed':
      return 'Identification stopped because of an unexpected error. The results found so far are kept.';
  }
}

/** A search result as one line: "Dawn — Eleni Karaindrou, Eternity and a Day, 1998, 3:41". */
export function resultLine({ song, seconds }: SearchResult): string {
  const details = [
    song.artist,
    song.album,
    song.year,
    seconds === null ? null : formatDuration(seconds * FRAMES_PER_SECOND),
  ].filter((part): part is string => part !== null && part !== '');
  return details.length === 0 ? song.title : `${song.title} — ${details.join(', ')}`;
}
