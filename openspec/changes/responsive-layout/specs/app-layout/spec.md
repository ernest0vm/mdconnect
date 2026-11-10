# Spec Delta

## Purpose

Defines how mdconnect arranges its screens in the window, from 320 CSS pixels wide to large desktop windows, so the device, the disc and its tracks use the available space in the desktop app and the web app.

## ADDED Requirements

### Requirement: Connected layout

When a device is connected, the app SHALL use the whole window. It SHALL show a header with the device name, its USB ID, Connect another device and the Appearance control. Below the header it SHALL show a disc summary and a track area. The GPL source footer SHALL stay visible at the bottom of the window.

#### Scenario: Device connected

- **WHEN** a NetMD device connects and its disc is read
- **THEN** the header shows the device name and USB ID, and the disc summary and track area fill the window below it

#### Scenario: Before connecting

- **WHEN** no device is connected
- **THEN** the connect prompt is shown in a centered card, as before

### Requirement: Track area fills the window

The track area SHALL take the height left below the header and disc summary, and SHALL scroll on its own. Its column headings (#, Title, Duration, Mode) and the track actions toolbar SHALL stay visible while the tracks scroll.

#### Scenario: Long disc

- **WHEN** a disc with 60 tracks is shown in a window 800 pixels high
- **THEN** the page itself does not scroll, the track list scrolls inside the track area, and the headings and toolbar stay in view

### Requirement: Wide windows

At 1024 CSS pixels wide and above, the connected layout SHALL show two columns: the disc summary on the left and the track area on the right, using the full width of the window.

#### Scenario: Desktop window

- **WHEN** the window is 1200 pixels wide with a disc shown
- **THEN** the disc summary is in a left column and the track area fills the rest of the width

### Requirement: Narrow windows

Below 1024 CSS pixels the connected layout SHALL show one column, with the disc summary above the track area. Below 640 pixels the toolbar SHALL wrap onto several lines, and each track row SHALL show the recording mode under the title. Down to 320 pixels wide, the page SHALL NOT scroll horizontally and every action SHALL stay reachable.

#### Scenario: Tablet width

- **WHEN** the window is 800 pixels wide
- **THEN** the disc summary is above a full-width track area

#### Scenario: Phone width

- **WHEN** the web app is shown 375 pixels wide
- **THEN** there is no horizontal scrolling, the toolbar wraps, and each row shows the number, title, mode and duration

### Requirement: Capacity bar

The disc summary SHALL show the used and free recording time as a bar, together with the used, free and total time as text. Assistive technology SHALL get the same values.

#### Scenario: Capacity bar

- **WHEN** a disc with 30:00 recorded on an 80-minute disc is shown
- **THEN** the bar is filled to 30 of 80 minutes, and the text says 30:00 used, 50:00 free and 80:00 total

### Requirement: Desktop window size

The desktop app SHALL open its main window at 1200 × 800 pixels, or smaller when the screen is smaller. The window SHALL NOT shrink below 480 × 560 pixels, except on a screen whose work area is smaller than that, where the window and its minimum SHALL fit the work area.

#### Scenario: First open

- **WHEN** the desktop app opens on a 1440 × 900 screen
- **THEN** the main window is 1200 × 800

#### Scenario: Very small screen

- **WHEN** the desktop app opens on a work area of 400 × 500
- **THEN** the main window is 400 × 500 and fits on the screen

#### Scenario: Resize

- **WHEN** the user drags the window smaller than 480 × 560
- **THEN** the window stops at 480 × 560 and the layout is still usable
