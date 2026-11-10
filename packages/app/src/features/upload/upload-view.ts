import { findDevice } from '@mdconnect/core';
import {
  remainingTitleSpace,
  sanitizeFullWidthTitle,
  sanitizeHalfWidthTitle,
  FRAMES_PER_SECOND,
  type Disc,
  type UploadMode,
} from '@mdconnect/netmd';

import { formatDuration } from '../disc/disc-view';
import type { ConversionFailure, RecordingMode } from './convert-track';
import type { AudioTags } from './tags';
import { titleFromSource, type TitleSource } from './title-source';
import { fitTitles, timeFit, type TrackTitles } from './upload-plan';
import type { UploadEvent, UploadSummary } from './upload-pipeline';
import type { UploadProgress } from './UploadDialog';

/** One track in the convert dialog. */
export interface ConvertItem {
  readonly id: number;
  readonly file: File;
  /** Null while the file's tags are being read. */
  readonly tags: AudioTags | null;
  /** Null until known; a file whose length cannot be found is measured by decoding it. */
  readonly durationSeconds: number | null;
  /** The mode of a pre-encoded ATRAC3 file, uploaded as is; null for other audio. */
  readonly atrac: UploadMode | null;
  /** Why this file will be skipped, found while reading it. */
  readonly problem: ConversionFailure | null;
  /** The titles as shown and typed, converted for the disc only when uploading. */
  readonly title: string;
  readonly fullWidthTitle: string;
  /** The user typed the title, so a new title source leaves it alone. */
  readonly edited: boolean;
}

const AUDIO_EXTENSIONS = new Set([
  'aac',
  'aif',
  'aiff',
  'at3',
  'flac',
  'm4a',
  'mka',
  'mp3',
  'mp4',
  'oga',
  'ogg',
  'oma',
  'opus',
  'wav',
  'webm',
  'wma',
]);

const extension = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

/** Splits dropped or picked files into audio the dialog lists and the names of everything else. */
export function audioFiles(files: readonly File[]): {
  readonly accepted: File[];
  readonly rejected: string[];
} {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const audio =
      file.type.startsWith('audio/') ||
      file.type === 'video/mp4' ||
      file.type === 'video/webm' ||
      AUDIO_EXTENSIONS.has(extension(file.name));
    if (audio) accepted.push(file);
    else rejected.push(file.name);
  }
  return { accepted, rejected };
}

/** Why tracks cannot be added now, or null when they can. */
export function addTracksBlocker(state: {
  readonly writeProtected: boolean;
  readonly busy: boolean;
}): string | null {
  if (state.writeProtected) return 'The disc is write-protected. Slide its tab to add tracks.';
  if (state.busy) return 'Wait for the current change or upload to finish.';
  return null;
}

/** The recording modes a deck offers: SP mono only where the deck records it natively. */
export function recordingModes(vendorId: number, productId: number): RecordingMode[] {
  const mono = findDevice(vendorId, productId)?.nativeMonoUpload === true;
  return mono ? ['sp', 'spMono', 'lp2', 'lp4'] : ['sp', 'lp2', 'lp4'];
}

/** The remembered mode when this deck offers it, otherwise SP. */
export const initialMode = (
  preferred: RecordingMode,
  offered: readonly RecordingMode[],
): RecordingMode => (offered.includes(preferred) ? preferred : 'sp');

export const MODE_LABELS: Readonly<Record<UploadMode, string>> = {
  sp: 'SP',
  spMono: 'SP mono',
  lp2: 'LP2',
  lp105: 'LP105',
  lp4: 'LP4',
};

export const TITLE_SOURCE_LABELS: Readonly<Record<TitleSource, string>> = {
  file: 'File name',
  title: 'Title',
  'album-title': 'Album – Title',
  'artist-title': 'Artist – Title',
  'title-artist': 'Title – Artist',
  'artist-album-title': 'Artist – Album – Title',
};

/** Moves item `index` by `delta` places; the list is returned as is at either end. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): readonly T[] {
  const target = index + delta;
  const moving = items[index];
  if (moving === undefined || target < 0 || target >= items.length) return items;
  const next = items.filter((_, i) => i !== index);
  next.splice(target, 0, moving);
  return next;
}

export const removeItem = <T>(items: readonly T[], index: number): T[] =>
  items.filter((_, i) => i !== index);

/** Titles each item from `source`, except titles the user typed. */
export function retitle(items: readonly ConvertItem[], source: TitleSource): ConvertItem[] {
  return items.map((item) =>
    item.edited
      ? item
      : { ...item, title: titleFromSource(source, item.tags ?? {}, item.file.name) },
  );
}

/** The mode a track is uploaded in: its own for a pre-encoded file, otherwise the chosen one. */
export const uploadModeOf = (item: ConvertItem, chosen: RecordingMode): UploadMode =>
  item.atrac ?? chosen;

/** The titles as they will be written: converted for the disc, then fitted to its space. */
export function preparedTitles(
  items: readonly ConvertItem[],
  disc: Disc,
  fullWidth: boolean,
): TrackTitles[] {
  const converted = items.map((item) => ({
    title: sanitizeHalfWidthTitle(item.title),
    fullWidthTitle: fullWidth ? sanitizeFullWidthTitle(item.fullWidthTitle) : '',
  }));
  return fitTitles(converted, remainingTitleSpace(disc), fullWidth).titles;
}

export interface FitView {
  /** "30:00 needed of 20:00 free", in SP time. */
  readonly text: string;
  readonly neededSeconds: number;
  readonly freeSeconds: number;
  readonly canUpload: boolean;
  /** Why upload is unavailable, or null. */
  readonly reason: string | null;
  readonly titlesShortened: boolean;
}

/** Whether the listed tracks fit on the disc in time and title space, as the dialog shows it. */
export function fitView(
  items: readonly ConvertItem[],
  chosen: RecordingMode,
  disc: Disc,
  fullWidth: boolean,
): FitView {
  const uploadable = items.filter((item) => item.problem === null);
  const time = timeFit(
    uploadable.map((item) => ({
      durationSeconds: item.durationSeconds ?? 0,
      mode: uploadModeOf(item, chosen),
    })),
    disc.left / FRAMES_PER_SECOND,
  );
  const converted = uploadable.map((item) => ({
    title: sanitizeHalfWidthTitle(item.title),
    fullWidthTitle: fullWidth ? sanitizeFullWidthTitle(item.fullWidthTitle) : '',
  }));
  const titlesShortened = fitTitles(converted, remainingTitleSpace(disc), fullWidth).shortened;
  const reading = items.some((item) => item.tags === null || item.durationSeconds === null);
  const seconds = (value: number) => formatDuration(Math.round(value * FRAMES_PER_SECOND));
  let reason: string | null = null;
  if (uploadable.length === 0) reason = 'Add at least one track that can be uploaded.';
  else if (reading) reason = 'Reading the files…';
  else if (!time.fits)
    reason = 'The tracks do not fit in the free time. Choose a long-play mode or remove tracks.';
  return {
    text: `${seconds(time.neededSeconds)} needed of ${seconds(time.freeSeconds)} free`,
    neededSeconds: time.neededSeconds,
    freeSeconds: time.freeSeconds,
    canUpload: reason === null,
    reason,
    titlesShortened,
  };
}

const SKIP_REASONS: Readonly<Record<ConversionFailure, string>> = {
  unreadable: 'the file could not be read',
  'not-decodable': 'it could not be decoded',
  'not-supported': 'this kind of file cannot be uploaded',
  'online-encoder-unavailable': 'the online encoder is not available',
  'encoder-failed': 'it could not be encoded',
  empty: 'it has no audio',
};

export const skipReasonText = (reason: ConversionFailure): string => SKIP_REASONS[reason];

/** One summary line for a track that was skipped. */
export const skippedLine = (title: string, reason: ConversionFailure): string =>
  `Skipped “${title}”: ${skipReasonText(reason)}.`;

const quoted = (titles: readonly string[], indexes: readonly number[]) =>
  indexes.map((index) => `“${titles[index] ?? `Track ${String(index + 1)}`}”`).join(', ');

/** The lines that close the upload dialog: what reached the disc, and what did not and why. */
export function summaryText(summary: UploadSummary, titles: readonly string[]): string[] {
  const count = summary.uploaded.length;
  const lines = [`${String(count)} ${count === 1 ? 'track' : 'tracks'} uploaded.`];
  for (const { index, reason } of summary.skipped) {
    lines.push(skippedLine(titles[index] ?? `Track ${String(index + 1)}`, reason));
  }
  if (summary.cancelled && summary.notUploaded.length > 0) {
    lines.push(`Cancelled before ${quoted(titles, [summary.notUploaded[0] ?? 0])}.`);
  } else if (summary.notUploaded.length > 0) {
    lines.push(
      `Not uploaded because the device stopped answering or refused the track: ${quoted(titles, summary.notUploaded)}.`,
    );
  }
  return lines;
}

/** The dialog's progress after one pipeline event. */
export function progressAfter(
  progress: UploadProgress,
  event: UploadEvent,
  titles: readonly string[],
): UploadProgress {
  switch (event.kind) {
    case 'converting':
      return { ...progress, converting: event.progress };
    case 'transferring':
      return {
        ...progress,
        index: event.index,
        title: titles[event.index] ?? '',
        writtenBytes: event.writtenBytes,
        totalBytes: event.totalBytes,
      };
    case 'uploaded':
      return { ...progress, writtenBytes: progress.totalBytes };
    case 'skipped':
      return progress;
  }
}

/** The progress shown when an upload starts. */
export const startingProgress = (titles: readonly string[]): UploadProgress => ({
  total: titles.length,
  index: 0,
  title: titles[0] ?? '',
  converting: 0,
  writtenBytes: 0,
  totalBytes: 1,
  stopping: false,
  finished: null,
});
