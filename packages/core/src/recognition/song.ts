/** A song a recognition service found, as the app shows and formats it. */
export interface Song {
  readonly title: string;
  /** The artist credit, as one line. */
  readonly artist: string;
  readonly album: string | null;
  /** The year of release, when the service gives one. */
  readonly year: string | null;
}
