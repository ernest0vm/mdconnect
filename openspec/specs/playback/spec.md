# playback Specification

## Purpose

Defines how mdconnect controls playback on a connected NetMD device and shows what it is playing, in the desktop app and the web app.

## Requirements

### Requirement: Player controls

When a NetMD device with a disc is connected, the app SHALL offer Previous, Play, Pause, Stop and Next controls. Play and Pause SHALL share one control that shows the action available in the current state.

#### Scenario: Play

- **WHEN** the device is stopped on track 3 and the user chooses Play
- **THEN** the device plays track 3 and the control changes to Pause

#### Scenario: Pause

- **WHEN** the device is playing and the user chooses Pause
- **THEN** the device pauses and the control changes to Play

#### Scenario: Stop

- **WHEN** the device is playing and the user chooses Stop
- **THEN** the device stops

### Requirement: Next and previous track

Next and Previous SHALL move playback to the following or preceding track. When the device rejects these commands, the app SHALL stop, go to the neighbouring track and play it, as webminidisc does. Next on the last track and Previous on the first track SHALL do nothing.

#### Scenario: Next track

- **WHEN** the device is playing track 3 of 10 and the user chooses Next
- **THEN** the device plays track 4

#### Scenario: Device without next and previous

- **WHEN** the device rejects the next-track command while playing track 3
- **THEN** the app stops, goes to track 4 and plays it

#### Scenario: Last track

- **WHEN** the device is on the last track and the user chooses Next
- **THEN** nothing is sent and playback continues

### Requirement: Play a track from the list

Each track row SHALL offer an action that plays that track. The row of the current track SHALL show whether it is playing or paused.

#### Scenario: Play a chosen track

- **WHEN** the user chooses Play on track 7 while track 2 is playing
- **THEN** the device plays track 7 and track 7's row shows that it is playing

### Requirement: Now playing

The player SHALL show the current track number, its title (or "Untitled") and the elapsed time in minutes and seconds. It SHALL also show the device state: playing, paused, stopped, fast-forward, rewind, reading the disc, or no disc.

#### Scenario: Playing

- **WHEN** the device is playing track 4, "Intro", at 1:23
- **THEN** the player shows track 4, "Intro" and 1:23, with the playing state

#### Scenario: Stopped

- **WHEN** the device is stopped
- **THEN** the player shows the stopped state and the track it would play next

### Requirement: Status kept current

While a device is connected and the app is visible, the app SHALL read the playback status about once a second. It SHALL also read it shortly after each control. It SHALL NOT read it while the app is hidden, and SHALL resume when the app is visible again. A status read SHALL NOT interleave with a disc read or an edit.

#### Scenario: Playback advances

- **WHEN** the device moves from track 4 to track 5 on its own
- **THEN** the player shows track 5 within about two seconds

#### Scenario: Hidden window

- **WHEN** the app's window or tab is hidden for a minute
- **THEN** no status reads are sent during that time, and they resume when it is shown again

#### Scenario: Status during an edit

- **WHEN** an edit is being written to the disc
- **THEN** status reads wait until the edit and the read that follows it have finished

### Requirement: When the controls are unavailable

The player controls SHALL be disabled, with a short reason, while no disc is inserted, while the disc is being read and while an edit is being saved. A control that the device rejects SHALL show a readable message, not a raw error.

#### Scenario: No disc

- **WHEN** no disc is inserted
- **THEN** the player controls are disabled and the player says there is no disc

#### Scenario: Device rejects a control

- **WHEN** the device rejects Play
- **THEN** the player says the device did not accept the command, and the status is read again
