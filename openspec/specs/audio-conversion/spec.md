# audio-conversion Specification

## Purpose

Defines how mdconnect turns the user's audio files into data a NetMD deck accepts for each recording mode, which encoders it uses, and when audio leaves the user's computer.

## Requirements

### Requirement: Decode audio files

The app SHALL decode audio files with the platform's own audio decoder, which covers at least MP3, AAC (M4A), FLAC, WAV and Ogg (Vorbis and Opus) in Chromium and Electron, and SHALL resample them to 44.1 kHz stereo. A file the platform cannot decode SHALL be reported as not decodable instead of failing the whole upload.

#### Scenario: Decode an MP3

- **WHEN** the user uploads a 48 kHz mono MP3 in SP
- **THEN** it is sent to the deck as 44.1 kHz stereo audio of the same length

#### Scenario: Unsupported format

- **WHEN** the user adds an AIFF file the platform cannot decode
- **THEN** that file is reported as not decodable and the other files are uploaded

### Requirement: SP audio

For SP and SP mono, the app SHALL send 44.1 kHz, 16-bit, big-endian stereo PCM and let the deck encode it. For SP mono the deck SHALL be asked to record mono.

#### Scenario: SP track length

- **WHEN** a 3-minute file is uploaded in SP
- **THEN** the new track on the disc lasts 3 minutes and is marked SP stereo

#### Scenario: SP mono

- **WHEN** a stereo file is uploaded in SP mono to a deck with native mono
- **THEN** the new track is marked SP mono

### Requirement: Built-in LP encoder

For LP2 and LP4, the app SHALL encode ATRAC3 itself with its bundled encoder, offline, in the LP2 (132 kbps) and LP4 (66 kbps) formats. The convert dialog SHALL say that this encoder's quality is lower than Sony's.

#### Scenario: Encode LP2 offline

- **WHEN** the computer has no network connection and the user uploads an MP3 in LP2 with the built-in encoder
- **THEN** the track is uploaded and marked LP2

#### Scenario: Quality note

- **WHEN** the user selects LP4 with the built-in encoder
- **THEN** the dialog shows that the built-in encoder's quality is lower than Sony's

### Requirement: Online Sony encoder

For LP2 and LP4, the app SHALL offer Sony's encoder through the online ATRAC service as an alternative. Before the first upload with it, the app SHALL tell the user that their audio files are sent to that service and ask them to confirm. The choice of encoder SHALL be remembered. If the service fails after three attempts, the track SHALL be skipped with that reason.

#### Scenario: First use asks for consent

- **WHEN** the user selects the online encoder for the first time and starts an upload
- **THEN** the app explains that the files are sent to the ATRAC service and uploads only after the user confirms

#### Scenario: Consent declined

- **WHEN** the user declines the notice
- **THEN** no file is sent and the built-in encoder stays selected

#### Scenario: Service unavailable

- **WHEN** the service cannot be reached on three attempts for a track
- **THEN** that track is skipped with the reason "The online encoder is not available", and the next track is attempted

### Requirement: No audio leaves the computer otherwise

The app SHALL NOT send audio, file names or tags anywhere except to the online ATRAC service when the user has chosen it. SP uploads and the built-in encoder SHALL work with no network connection.

#### Scenario: SP upload makes no network request

- **WHEN** the user uploads a file in SP
- **THEN** the app makes no network request

### Requirement: ReplayGain

When ReplayGain is enabled in the convert dialog, the app SHALL apply each file's ReplayGain track gain from its tags, limited so the audio does not clip. Files without the tag SHALL be uploaded unchanged, and so SHALL pre-encoded ATRAC3 files, which are never re-encoded. ReplayGain SHALL be off by default and remembered.

#### Scenario: Apply track gain

- **WHEN** ReplayGain is enabled and a file is tagged with a track gain of -6 dB
- **THEN** its audio is uploaded at about half the amplitude

#### Scenario: No tag

- **WHEN** ReplayGain is enabled and a file has no ReplayGain tag
- **THEN** the file is uploaded at its original level

#### Scenario: Pre-encoded file with a track gain

- **WHEN** ReplayGain is enabled and an ATRAC3 WAV tagged with a track gain of -6 dB is added
- **THEN** it is uploaded as is, at its original level

### Requirement: Pre-encoded ATRAC3

ATRAC3 WAV files and unencrypted OMA files at LP2 (132 kbps), LP105 (105 kbps) or LP4 (66 kbps) SHALL be uploaded without re-encoding, in their own mode, whatever mode the dialog selects. Encrypted OMA files SHALL be reported as not supported.

#### Scenario: LP4 ATRAC3 WAV

- **WHEN** the user uploads an ATRAC3 WAV encoded at 66 kbps while SP is selected
- **THEN** the track is uploaded as is and marked LP4

#### Scenario: LP105 file

- **WHEN** the user uploads an ATRAC3 file encoded at 105 kbps
- **THEN** the track is uploaded as is and marked LP2, the disc mode the deck uses for 105 kbps

#### Scenario: Encrypted OMA

- **WHEN** the user adds an encrypted OMA file
- **THEN** it is reported as not supported and not uploaded
