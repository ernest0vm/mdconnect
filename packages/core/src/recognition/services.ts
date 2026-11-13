import { sourceRepositoryUrl } from '../source';

/** AcoustID's lookup service, which answers web pages (`Access-Control-Allow-Origin: *`). */
export const ACOUSTID_ORIGIN = 'https://api.acoustid.org';

/** MusicBrainz's web service, which answers web pages too. */
export const MUSICBRAINZ_ORIGIN = 'https://musicbrainz.org';

/**
 * mdconnect's AcoustID application key, registered at acoustid.org as the application "mdconnect".
 * It identifies the application, not a user, and is public in open-source clients such as
 * MusicBrainz Picard; the web app sends it in every lookup anyway. A key that is abused can be
 * replaced there. It is not the maintainer's user key, which only submitting fingerprints needs.
 */
export const ACOUSTID_CLIENT_KEY = 'wO20poQINj';

/** How the desktop app names itself to MusicBrainz and AcoustID, as their rules ask. */
export function recognitionUserAgent(version: string): string {
  return `mdconnect/${version} ( ${sourceRepositoryUrl} )`;
}
