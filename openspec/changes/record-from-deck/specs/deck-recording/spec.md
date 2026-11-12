# Spec Delta

## Purpose

Defines how mdconnect records tracks from a deck's analogue output into audio files: which tracks, from which input, how each recording is started and timed, how files are named and saved, and what the app allows while recording.

## ADDED Requirements

### Requirement: Record action

The track toolbar SHALL offer Record, in the desktop app and in the web app. It SHALL record the selected tracks, in disc order. Record SHALL be unavailable, with the reason, when no track is selected, when the player cannot be used, or while a change or upload is in progress. A write-protected disc SHALL NOT block it.

#### Scenario: Record selected tracks

- **WHEN** tracks 2 and 5 are selected and the user chooses Record
- **THEN** the setup dialog opens for those two tracks, in that order

#### Scenario: Nothing selected

- **WHEN** no track is selected
- **THEN** Record is unavailable and says to select tracks

#### Scenario: Write-protected disc

- **WHEN** the disc is write-protected and a track is selected
- **THEN** Record is available

### Requirement: Input setup

Before recording, a setup dialog SHALL explain that the deck's line-out or headphone output must be connected to the computer's audio input, list the computer's audio inputs by name, and show a live level meter for the chosen input. Choosing an input SHALL ask the system for permission to capture audio when it has not been granted. The dialog SHALL remember the chosen input for the next recording. It SHALL be operable with the keyboard alone.

#### Scenario: Choose an input

- **WHEN** the user opens the setup dialog and picks "Line In"
- **THEN** the level meter moves with the audio arriving at Line In

#### Scenario: Remembered input

- **WHEN** the user recorded from "Line In" before and opens the setup dialog again
- **THEN** "Line In" is already chosen

#### Scenario: Permission refused

- **WHEN** the user or the system refuses audio capture
- **THEN** the dialog says that mdconnect cannot hear the input and how to allow it, and recording cannot start

#### Scenario: No input

- **WHEN** the computer has no audio input
- **THEN** the dialog says so and recording cannot start

### Requirement: Recording a track

For each track, the app SHALL start the track on the deck from its beginning, capture the chosen input while the track plays, and stop capturing after the track's length plus a short margin. The audio SHALL be captured without echo cancellation, noise suppression or automatic gain, in stereo, at 44.1 kHz where the input offers it and otherwise at the input's own rate. When every track is done, or the recording is cancelled, the deck SHALL be stopped.

#### Scenario: One track

- **WHEN** the user records a 3:20 track
- **THEN** the deck plays the track from 0:00, and the saved file holds about 3:20 of audio

#### Scenario: Several tracks

- **WHEN** the user records tracks 2 and 5
- **THEN** the deck plays track 2, then track 5, each from its beginning, and two files are saved

#### Scenario: Deck stopped at the end

- **WHEN** the last track has been recorded
- **THEN** the deck is stopped

### Requirement: Recording file names

Each recorded track SHALL be saved as a 16-bit PCM WAV file at the capture's sample rate, named `NN Title.wav` from its track number and title, with the full-width title in parentheses when the track has one. An untitled track SHALL be named `NN Track NN.wav`. Characters that file systems refuse SHALL be replaced with a hyphen.

#### Scenario: File name

- **WHEN** track 3, titled "Dawn: Part 1/2", is recorded
- **THEN** the file is named `03 Dawn- Part 1-2.wav`

#### Scenario: Untitled track

- **WHEN** an untitled track 7 is recorded
- **THEN** the file is named `07 Track 07.wav`

### Requirement: Where recordings are saved

Where the platform lets the app write to a folder, the user SHALL pick the folder once when recording starts, and every file SHALL be written there. An existing file with the same name SHALL NOT be overwritten. Where folder access is not available, each file SHALL be downloaded as it is finished.

#### Scenario: Folder chosen once

- **WHEN** the user records three tracks and picks a folder when asked
- **THEN** the three files are written to that folder without asking again

#### Scenario: Name already taken

- **WHEN** the folder already has `03 Dawn.wav` and track 3 "Dawn" is recorded
- **THEN** the new file is saved as `03 Dawn (2).wav`

#### Scenario: Folder picking cancelled

- **WHEN** the user cancels the folder picker
- **THEN** no track is played or recorded

### Requirement: Recording progress and cancel

While recording, a dialog SHALL show which track is being recorded out of how many, its title, how far into it the recording is, and the live input level. It SHALL offer Cancel, which stops the deck and the capture at once, keeps the files already saved and discards the track in progress. When the recording ends, the dialog SHALL say how many files were saved and where.

#### Scenario: Progress

- **WHEN** track 2 of 3 is being recorded
- **THEN** the dialog shows "Track 2 of 3", the track's title and its progress

#### Scenario: Cancel

- **WHEN** the user cancels during track 2 of 3
- **THEN** the deck stops, the file for track 1 stays, and no file is saved for track 2

#### Scenario: Summary

- **WHEN** three tracks have been recorded to a folder named "MiniDisc"
- **THEN** the dialog says that 3 files were saved to "MiniDisc"

### Requirement: App while recording

While recording, the app SHALL keep the screen on where the platform allows it, and SHALL make editing, uploads, the player controls and Record unavailable, with a reason saying that a recording is in progress. Recording SHALL continue while the app's window or tab is hidden. When the device is unplugged during a recording, the recording SHALL stop, keep the files already saved and say that the device was disconnected.

#### Scenario: Controls blocked

- **WHEN** a recording is in progress
- **THEN** Rename, Delete, Add tracks and the player controls are unavailable and say that a recording is in progress

#### Scenario: Hidden window

- **WHEN** the user switches to another window during a 10-minute recording
- **THEN** the recording continues and the saved file holds the whole track

#### Scenario: Unplugged

- **WHEN** the deck is unplugged while track 2 of 3 is being recorded
- **THEN** recording stops, the file for track 1 stays, and the app says that the device was disconnected
