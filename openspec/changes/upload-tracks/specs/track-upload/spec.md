# Spec Delta

## Purpose

Defines how mdconnect records the user's audio files onto the disc in a connected NetMD device: choosing files and options, checking they fit, and uploading them with progress, cancel and error handling that keep the disc consistent.

## ADDED Requirements

### Requirement: Add tracks

When a writable disc is shown, the app SHALL let the user choose audio files with an "Add tracks" action or by dropping files on the disc panel, and SHALL open the convert dialog with those files in the order given. Adding tracks SHALL be unavailable while the disc is write-protected, while another change is being saved, or while an upload runs, with the reason shown.

#### Scenario: Pick files

- **WHEN** the user chooses "Add tracks" and picks "a.mp3" and "b.flac"
- **THEN** the convert dialog opens listing "a.mp3" then "b.flac"

#### Scenario: Drop files

- **WHEN** the user drops three audio files on the disc panel
- **THEN** the convert dialog opens listing the three files

#### Scenario: Write-protected disc

- **WHEN** the disc's write-protect tab is set
- **THEN** "Add tracks" is disabled with the write-protected reason, and dropped files are refused with the same reason

#### Scenario: Files that are not audio

- **WHEN** the user drops "notes.txt" together with "a.mp3"
- **THEN** the convert dialog lists only "a.mp3" and says that "notes.txt" is not an audio file

### Requirement: Recording mode

The convert dialog SHALL offer the recording modes SP, LP2 and LP4, and SP mono only when the connected deck records mono natively. The last mode chosen SHALL be preselected the next time the dialog opens, falling back to SP when it is not offered.

#### Scenario: Deck without native mono

- **WHEN** the convert dialog opens for a Sony MZ-NE410
- **THEN** the modes offered are SP, LP2 and LP4

#### Scenario: Deck with native mono

- **WHEN** the convert dialog opens for a Sony MDS-JB980
- **THEN** the modes offered are SP, SP mono, LP2 and LP4

#### Scenario: Remembered mode

- **WHEN** the user uploads in LP2 and later opens the convert dialog again
- **THEN** LP2 is selected

### Requirement: Track titles from files

The convert dialog SHALL title each track from a chosen source: the file name without its extension (the default), or the file's tags as Title, Album – Title, Artist – Title, Title – Artist, or Artist – Album – Title. A track whose tags lack a field the source needs SHALL fall back to its file name. The chosen source SHALL be remembered.

#### Scenario: Title from file name

- **WHEN** the source is the file name and the file is "01 Intro.mp3"
- **THEN** the track's title is "01 Intro"

#### Scenario: Title from tags

- **WHEN** the source is Artist – Title and the file is tagged artist "Cibo Matto", title "Know Your Chicken"
- **THEN** the track's title is "Cibo Matto - Know Your Chicken"

#### Scenario: Missing tag

- **WHEN** the source is Artist – Title and "demo.wav" has no tags
- **THEN** the track's title is "demo"

### Requirement: Edit the track list

Before uploading, the convert dialog SHALL let the user reorder tracks, remove a track, add more files, and rename a track with a half-width title and, when full-width titles are enabled, a full-width title. Tracks SHALL be uploaded in the order shown and appended after the disc's last track. Titles SHALL be converted for the disc as the disc-editing titles are.

#### Scenario: Reorder

- **WHEN** the dialog lists "a" then "b" and the user moves "b" up
- **THEN** "b" is uploaded before "a"

#### Scenario: Rename before upload

- **WHEN** the user renames "track01" to "Opening" in the dialog and uploads it to a disc with 4 tracks
- **THEN** the disc's track 5 is titled "Opening"

#### Scenario: Remove the last track

- **WHEN** the user removes every track from the dialog
- **THEN** the upload action is disabled

### Requirement: Fit check

The convert dialog SHALL show the time the tracks need in the chosen mode against the disc's free time, and the title characters they need against the disc's remaining title space. Free time is counted in SP time: a track uses its full length of it in SP, half in SP mono and LP2, and a quarter in LP4. The upload SHALL be refused while the tracks do not fit in time; titles that do not fit SHALL be shortened with a warning.

#### Scenario: Fits in LP2 but not in SP

- **WHEN** the disc has 20 minutes free and the tracks last 30 minutes
- **THEN** in SP the dialog says they do not fit and upload is disabled, and in LP2 upload is enabled

#### Scenario: Title space runs out

- **WHEN** the tracks' titles need more characters than the disc has left
- **THEN** the dialog warns that some titles will be shortened, and upload stays enabled

#### Scenario: Unknown duration

- **WHEN** a file's duration cannot be determined before decoding
- **THEN** the dialog decodes it to measure its duration before enabling upload

### Requirement: Upload progress

During an upload the app SHALL show the current track and its number out of the total, a conversion progress and a transfer progress. The app SHALL stop playback before the upload starts, keep the screen from sleeping while it runs, and block other changes to the disc until it ends.

#### Scenario: Progress shown

- **WHEN** the second of three tracks is being transferred
- **THEN** the dialog shows "Track 2 of 3" with its title and both progress bars

#### Scenario: Playback stopped

- **WHEN** a track is playing and the user starts an upload
- **THEN** playback stops before the first track is transferred

### Requirement: Cancel an upload

The user SHALL be able to cancel an upload. The track being transferred SHALL be finished and kept, no later track SHALL be uploaded, and the dialog SHALL say it is stopping after the current track until it does.

#### Scenario: Cancel during the second track

- **WHEN** the user cancels while track 2 of 4 is being transferred
- **THEN** tracks 1 and 2 are on the disc, tracks 3 and 4 are not, and the disc is read again

### Requirement: Upload errors

If a track cannot be converted, the app SHALL skip it, keep going, and list it at the end with the reason. If the device fails, the app SHALL stop the upload, keep the tracks already written, and show which tracks were not uploaded. In every case the app SHALL end the device's upload session and read the disc again.

#### Scenario: A file cannot be decoded

- **WHEN** the second of three files cannot be decoded
- **THEN** tracks 1 and 3 are uploaded, and the summary says the second file was skipped because it could not be decoded

#### Scenario: Device fails mid-upload

- **WHEN** the device rejects the transfer of track 3 of 5
- **THEN** tracks 1 and 2 stay on the disc, the app reports that tracks 3 to 5 were not uploaded, and the disc is read again

#### Scenario: Unplugged during an upload

- **WHEN** the device is unplugged while a track is transferred
- **THEN** the upload ends and the Connect screen shows the device as disconnected

### Requirement: Uploaded track titles

Each uploaded track SHALL be written with its half-width title and, when it differs, its full-width title, before the track is committed to the disc.

#### Scenario: Titles written

- **WHEN** track "Opening" with the full-width title "序曲" is uploaded
- **THEN** after the disc is read again the new track shows "Opening" and "序曲"

### Requirement: Upload works on both apps

Uploading SHALL work the same in the desktop app and in the web app.

#### Scenario: Upload in the web app

- **WHEN** the user uploads an MP3 in SP from Chrome
- **THEN** the track is on the disc after it is read again, as in the desktop app
