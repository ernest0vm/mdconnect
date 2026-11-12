const MAX_LENGTH = 200;
const EXTENSION = '.wav';

/** What a file name needs to know about a track. */
export interface NamedTrack {
  /** Zero-based track number. */
  readonly index: number;
  readonly title: string;
  readonly fullWidthTitle: string;
}

/**
 * The file a recorded track is saved as: `NN Title (Full-width title).wav`, or `NN Track NN.wav`
 * for an untitled track, with characters that file systems refuse replaced by a hyphen.
 */
export function recordingFileName(track: NamedTrack, trackCount: number): string {
  const number = String(track.index + 1).padStart(trackCount >= 100 ? 3 : 2, '0');
  const parts = [track.title.trim(), track.fullWidthTitle.trim()].filter((part) => part !== '');
  const [first, second] = parts;
  const title =
    first === undefined ? `Track ${number}` : second === undefined ? first : `${first} (${second})`;
  const stem = `${number} ${title}`
    // eslint-disable-next-line no-control-regex -- control characters are refused in file names.
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/gu, '-')
    .slice(0, MAX_LENGTH - EXTENSION.length)
    .replace(/[. ]+$/u, '');
  return `${stem}${EXTENSION}`;
}
