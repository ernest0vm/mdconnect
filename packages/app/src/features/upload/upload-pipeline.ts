/*
 * The upload loop, after webminidisc's `convertAndUpload` (src/redux/actions.ts),
 * https://github.com/asivery/webminidisc, GPL-2.0.
 *
 * Changes from upstream: a track that fails to convert is skipped and the loop continues
 * (upstream's error escaped the loop and left the session open), and the session is closed in
 * every outcome.
 */

import type { TrackTransferProgress, UploadSession } from '@mdconnect/netmd';

import { ConversionError, type ConversionFailure, type ConvertedTrack } from './convert-track';

/** One track to upload, its titles already converted and fitted to the disc. */
export interface UploadItem {
  readonly title: string;
  readonly fullWidthTitle: string;
}

/** The part of `UploadSession` the loop uses. */
export type UploadPort = Pick<UploadSession, 'open' | 'uploadTrack' | 'close'>;

export type UploadEvent =
  | { readonly kind: 'converting'; readonly index: number; readonly progress: number }
  | {
      readonly kind: 'transferring';
      readonly index: number;
      readonly writtenBytes: number;
      readonly totalBytes: number;
    }
  | { readonly kind: 'uploaded'; readonly index: number; readonly track: number }
  | { readonly kind: 'skipped'; readonly index: number; readonly reason: ConversionFailure };

export interface UploadDependencies {
  /**
   * Converts item `index`; reports progress from 0 to 1. Throws `ConversionError` to skip it.
   * `signal` aborts when the upload ends early, so a conversion started ahead stops.
   */
  readonly convert: (
    index: number,
    onProgress: (progress: number) => void,
    signal: AbortSignal,
  ) => Promise<ConvertedTrack>;
  readonly session: UploadPort;
  /** Checked between tracks: the track being transferred always finishes. */
  readonly isCancelled: () => boolean;
  readonly onEvent?: (event: UploadEvent) => void;
}

export interface UploadSummary {
  /** Indexes of the items now on the disc. */
  readonly uploaded: number[];
  readonly skipped: { readonly index: number; readonly reason: ConversionFailure }[];
  /** Indexes of items not uploaded because of a device error or a cancel. */
  readonly notUploaded: number[];
  readonly cancelled: boolean;
  /** The device error that stopped the upload, if any. */
  readonly failure: unknown;
}

type Conversion = { readonly track: ConvertedTrack } | { readonly reason: ConversionFailure };

/**
 * Uploads the items in order, converting the next one while the current one transfers. A track
 * that cannot be converted is skipped; a device error stops the upload. Either way the tracks
 * already written stay, and the session is closed.
 */
export async function runUpload(
  items: readonly UploadItem[],
  dependencies: UploadDependencies,
): Promise<UploadSummary> {
  const { session, onEvent } = dependencies;
  // Aborted when the loop ends, so a conversion started for a track that will not be uploaded
  // (after a cancel or a device error) stops instead of running on, or posting a file online.
  const ahead = new AbortController();
  const conversions = new Map<number, Promise<Conversion>>();
  const convert = (index: number): Promise<Conversion> => {
    let conversion = conversions.get(index);
    if (conversion === undefined) {
      onEvent?.({ kind: 'converting', index, progress: 0 });
      conversion = dependencies
        .convert(
          index,
          (progress) => onEvent?.({ kind: 'converting', index, progress }),
          ahead.signal,
        )
        .then(
          (track) => {
            onEvent?.({ kind: 'converting', index, progress: 1 });
            return { track };
          },
          (error: unknown) => ({
            reason: error instanceof ConversionError ? error.reason : 'encoder-failed',
          }),
        );
      conversions.set(index, conversion);
    }
    return conversion;
  };

  const uploaded: number[] = [];
  const skipped: UploadSummary['skipped'] = [];
  const remaining = (from: number) => items.map((_, i) => i).slice(from);
  try {
    try {
      await session.open();
    } catch (failure) {
      return { uploaded, skipped, notUploaded: remaining(0), cancelled: false, failure };
    }
    for (const [index, item] of items.entries()) {
      if (dependencies.isCancelled()) {
        return { uploaded, skipped, notUploaded: remaining(index), cancelled: true, failure: null };
      }
      const conversion = await convert(index);
      // The user may have cancelled while this track was converting: send nothing more.
      if (dependencies.isCancelled()) {
        return { uploaded, skipped, notUploaded: remaining(index), cancelled: true, failure: null };
      }
      if (index + 1 < items.length) void convert(index + 1);
      if ('reason' in conversion) {
        skipped.push({ index, reason: conversion.reason });
        onEvent?.({ kind: 'skipped', index, reason: conversion.reason });
        continue;
      }
      let track: number;
      try {
        onEvent?.({ kind: 'transferring', index, writtenBytes: 0, totalBytes: 1 });
        track = await session.uploadTrack(
          { ...conversion.track, title: item.title, fullWidthTitle: item.fullWidthTitle },
          (progress: TrackTransferProgress) =>
            onEvent?.({ kind: 'transferring', index, ...progress }),
        );
      } catch (failure) {
        return { uploaded, skipped, notUploaded: remaining(index), cancelled: false, failure };
      }
      uploaded.push(index);
      onEvent?.({ kind: 'uploaded', index, track });
    }
    return { uploaded, skipped, notUploaded: [], cancelled: false, failure: null };
  } finally {
    ahead.abort(new Error('The upload ended'));
    await session.close();
  }
}
