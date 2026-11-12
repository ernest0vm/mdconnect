# Spec Delta

## MODIFIED Requirements

### Requirement: No audio leaves the computer otherwise

The app SHALL NOT send audio, file names or tags anywhere except to the online ATRAC service when the user has chosen it. Song recognition, when the user has agreed to it, SHALL send only signatures, fingerprints, track lengths and search text, never audio. In the desktop app, SP uploads and the built-in encoder SHALL work with no network connection. In the web app, SP uploads SHALL work offline once the page has loaded; the built-in encoder's files are fetched the first time it is used, so it needs a connection then.

#### Scenario: SP upload makes no network request

- **WHEN** the user uploads a file in SP
- **THEN** the app makes no network request

#### Scenario: Recognition sends no audio

- **WHEN** the user identifies a track with Shazam or AcoustID
- **THEN** Shazam's requests carry a signature and the excerpt's length, AcoustID's carry a fingerprint and the track's length, and none carries audio samples
