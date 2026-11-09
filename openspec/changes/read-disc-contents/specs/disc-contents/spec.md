## Purpose

Defines how mdconnect reads the contents of the disc in a connected NetMD device and presents them: titles, groups, tracks, capacity and protection. It also covers the loading, empty and error states around reading.

## ADDED Requirements

### Requirement: Read the disc after connecting

When a NetMD device connects, in the desktop app or the web app, the app SHALL read the inserted disc without further user action and show its contents. While reading, it SHALL show a reading state. It SHALL offer a Refresh action that reads the disc again.

#### Scenario: Disc read on connect

- **WHEN** the user connects a NetMD device with a recorded disc inserted
- **THEN** the screen shows a reading state, then the disc title and its tracks

#### Scenario: Refresh after changing discs

- **WHEN** the user swaps the disc in the connected device and clicks Refresh
- **THEN** the screen shows the contents of the new disc

### Requirement: Tracks and groups

The app SHALL list every track in disc order with its number, title, duration (minutes and seconds) and recording mode (SP, LP2, LP4, and mono where the track is mono). Tracks that belong to a group SHALL be shown under that group's title; tracks outside any group SHALL be listed without a group. A missing title SHALL be shown as a neutral placeholder, not as an empty line.

#### Scenario: Grouped disc

- **WHEN** the disc has tracks 1 and 2 in a group "Side A" and track 3 in no group
- **THEN** tracks 1 and 2 appear under "Side A" and track 3 appears outside any group, in that order

#### Scenario: Untitled track

- **WHEN** a track has no title
- **THEN** its row shows the placeholder "Untitled" with its number, duration and mode

#### Scenario: Japanese titles

- **WHEN** a disc or track title was written in full-width (Japanese) characters
- **THEN** the title is displayed with those characters, not as replacement symbols

### Requirement: Disc capacity and protection

The app SHALL show the disc's used, free and total recording time as minutes and seconds in SP terms, and SHALL indicate when the disc is write-protected.

#### Scenario: Capacity

- **WHEN** a disc with 30:00 recorded on an 80-minute disc is read
- **THEN** the screen shows 30:00 used, 50:00 free and 80:00 total

#### Scenario: Write-protected disc

- **WHEN** the inserted disc has its write-protect tab set
- **THEN** the screen shows that the disc is write-protected

### Requirement: No disc and blank discs

When no disc is inserted, the app SHALL say so and offer Refresh. A blank disc SHALL be shown with no tracks and its full capacity free, not as an error.

#### Scenario: No disc inserted

- **WHEN** a NetMD device without a disc connects
- **THEN** the screen says no disc is inserted and offers Refresh

#### Scenario: Blank disc

- **WHEN** a blank disc is read
- **THEN** the screen shows an empty track list and the whole capacity as free

### Requirement: Read failures

A failed read SHALL show a readable message with a Retry action, never a raw error. If the device is unplugged while reading, the app SHALL return to the Connect screen as for any unplug. A device that does not answer NetMD commands SHALL get a message that mdconnect cannot read discs in Hi-MD mode yet, with a suggestion to switch the device to NetMD mode if it offers one.

#### Scenario: Command fails

- **WHEN** a NetMD command fails or times out while reading
- **THEN** the screen explains that the disc could not be read and offers Retry

#### Scenario: Unplugged while reading

- **WHEN** the device is unplugged while its disc is being read
- **THEN** the Connect screen returns, as for any unplug, and no read error is shown

#### Scenario: Device in Hi-MD mode

- **WHEN** a connected device does not answer NetMD commands (for example an MZ-NH600 in Hi-MD mode, which shares `054c:0187` with the NetMD MZ-NH600D, or a Hi-MD-mode device opened by the desktop app)
- **THEN** the screen says mdconnect cannot read discs in Hi-MD mode yet and suggests switching the device to NetMD mode if it offers one
