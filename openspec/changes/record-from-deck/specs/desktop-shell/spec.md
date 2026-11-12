# Spec Delta

## ADDED Requirements

### Requirement: Renderer permissions

The desktop app SHALL grant its own pages only the permissions they use: USB access to supported devices and audio capture without video. It SHALL deny every other permission request, and every request from any other origin. The macOS build SHALL declare why it uses the audio input, so that macOS can ask the user.

#### Scenario: Audio capture allowed

- **WHEN** the app asks to capture audio from an input
- **THEN** the request is granted to the app's page, subject to the operating system's own microphone permission

#### Scenario: Video refused

- **WHEN** the app's page asks for camera access
- **THEN** the request is denied

#### Scenario: Other permission refused

- **WHEN** the app's page asks for notifications or geolocation
- **THEN** the request is denied

#### Scenario: macOS asks once

- **WHEN** the desktop app first captures audio on macOS
- **THEN** macOS asks the user to allow microphone access for mdconnect, with the app's stated reason

### Requirement: Recording folder

The privileged API SHALL let UI code ask the user for a folder through the native folder dialog, and write files into that folder only. UI code SHALL NOT see or pass file-system paths. A file name with a path separator, `..` or a control character SHALL be refused, and an existing file SHALL NOT be overwritten: the new file gets a free name instead.

#### Scenario: Write into the chosen folder

- **WHEN** the user picks a folder and the app writes `03 Dawn.wav`
- **THEN** the file is created in that folder, and the app learns its final name, not its path

#### Scenario: Path in a file name

- **WHEN** UI code asks to write `../evil.wav`
- **THEN** the write is refused and nothing is created

#### Scenario: No folder picked

- **WHEN** UI code asks to write before any folder was picked, or with a folder id from an earlier session
- **THEN** the write is refused

### Requirement: Recording files written in parts

The privileged API SHALL write a recording file in parts, so a long recording does not cross it whole, and SHALL remove a file that UI code discards before it is finished.

#### Scenario: Discarded file

- **WHEN** UI code creates `03 Dawn.wav`, appends part of it and then discards it
- **THEN** no `03 Dawn.wav` is left in the folder
