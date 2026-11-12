# Spec Delta

## MODIFIED Requirements

### Requirement: Network destinations

In packaged builds the UI SHALL only open network connections to the app's own origin, to the online ATRAC encoding service at `https://atrac.minidisc.wiki`, and to the recognition services at `https://api.acoustid.org` and `https://musicbrainz.org`. Connections to any other origin SHALL be blocked. The web app SHALL apply the same rule through the shared Content Security Policy.

#### Scenario: Encoding service allowed

- **WHEN** the user uploads in LP2 with the online encoder
- **THEN** the request to `https://atrac.minidisc.wiki` is allowed

#### Scenario: Recognition services allowed

- **WHEN** the user identifies a track with AcoustID or searches MusicBrainz by name
- **THEN** the requests to `https://api.acoustid.org` and `https://musicbrainz.org` are allowed

#### Scenario: Other origins blocked

- **WHEN** UI code in a packaged build calls `fetch` for `https://example.com`
- **THEN** the request is refused by the Content Security Policy

## ADDED Requirements

### Requirement: Shazam requests

The privileged API SHALL let the app's own pages ask Shazam about a signature. The main process SHALL send it only to Shazam's recognition endpoint, only when it is a well-formed signature of at most 15 seconds of audio, and SHALL return only the song's title, artist, album and year, or no match. Calls from any other origin SHALL be refused.

#### Scenario: Recognised excerpt

- **WHEN** the page sends the signature of a 12-second excerpt that Shazam recognises
- **THEN** the main process returns that song's title, artist, album and year

#### Scenario: Malformed request

- **WHEN** the page sends data that is not a valid signature, or one longer than 15 seconds
- **THEN** the call is refused and nothing is sent to Shazam

#### Scenario: Other origin

- **WHEN** a page from another origin calls the Shazam bridge
- **THEN** the call is refused
