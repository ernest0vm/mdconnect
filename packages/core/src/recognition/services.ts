import { sourceRepositoryUrl } from '../source';

/** AcoustID's lookup service, which answers web pages (`Access-Control-Allow-Origin: *`). */
export const ACOUSTID_ORIGIN = 'https://api.acoustid.org';

/** MusicBrainz's web service, which answers web pages too. */
export const MUSICBRAINZ_ORIGIN = 'https://musicbrainz.org';

/**
 * mdconnect's AcoustID application key. It identifies the application, not a user, and is public
 * in open-source clients. It is registered by the maintainer at https://acoustid.org/new-application;
 * until then this placeholder makes every lookup fail as "The service could not be reached".
 */
export const ACOUSTID_CLIENT_KEY = 'REGISTER-AT-ACOUSTID';

/** How the desktop app names itself to MusicBrainz and AcoustID, as their rules ask. */
export function recognitionUserAgent(version: string): string {
  return `mdconnect/${version} ( ${sourceRepositoryUrl} )`;
}
