import { parseBlob } from 'music-metadata';

/** What the convert dialog uses from a file's tags. Absent fields were not in the file. */
export interface AudioTags {
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly durationSeconds?: number;
  /** The ReplayGain track gain, in dB. */
  readonly trackGainDb?: number;
}

/**
 * Reads a file's tags and duration. A file whose tags cannot be read gets none: it is still
 * uploaded, titled from its file name.
 */
export async function readTags(file: Blob): Promise<AudioTags> {
  let metadata: Awaited<ReturnType<typeof parseBlob>>;
  try {
    metadata = await parseBlob(file, { duration: false, skipCovers: true });
  } catch {
    return {};
  }
  const { common, format } = metadata;
  return {
    ...(common.title === undefined ? {} : { title: common.title }),
    ...(common.artist === undefined ? {} : { artist: common.artist }),
    ...(common.album === undefined ? {} : { album: common.album }),
    ...(format.duration === undefined ? {} : { durationSeconds: format.duration }),
    ...(common.replaygain_track_gain?.dB === undefined
      ? {}
      : { trackGainDb: common.replaygain_track_gain.dB }),
  };
}
