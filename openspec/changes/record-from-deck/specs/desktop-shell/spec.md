# Spec Delta

## ADDED Requirements

### Requirement: Renderer permissions

The desktop app SHALL grant its own pages only the permissions they use: USB access to supported devices, audio capture without video, and access to a folder the user picks. It SHALL deny every other permission request, and every request from any other origin. The macOS build SHALL declare why it uses the audio input, so that macOS can ask the user.

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
