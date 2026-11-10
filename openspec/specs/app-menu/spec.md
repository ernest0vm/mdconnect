# app-menu Specification

## Purpose

Defines the menu on the connected screen, the About dialog and how the user ends the session with a device, in the desktop app and the web app.

## Requirements

### Requirement: Menu

When a device is connected, the header SHALL offer a "More" menu with Export titles to CSV, Import titles from CSV, Wipe disc, About and Exit. The menu SHALL be operable with the keyboard alone, and an item that is unavailable SHALL say why.

#### Scenario: Open with the keyboard

- **WHEN** the user focuses More, presses Enter and moves with the arrow keys
- **THEN** each available item can be reached and chosen; an unavailable item is skipped and shows why under its name, and Escape closes the menu and returns focus to More

#### Scenario: Focus after a dialog

- **WHEN** the user closes a dialog opened from the menu, such as About
- **THEN** focus returns to More

#### Scenario: Unavailable item

- **WHEN** the disc is write-protected
- **THEN** Wipe disc and Import titles from CSV are unavailable, and the menu says the disc is write-protected

### Requirement: About

About SHALL show the build commit, or say that it is a development build, state that mdconnect is free software under GPL-2.0 with a link to its source, and credit webminidisc and netmd-js with their authors.

#### Scenario: About

- **WHEN** the user chooses About
- **THEN** a dialog shows the build commit, the GPL-2.0 notice with the source link, and the credits

### Requirement: Exit

Exit SHALL end the NetMD session with the device, as webminidisc's Exit does, and return to the Connect screen. A read, edit or playback command in progress SHALL finish first.

#### Scenario: Exit

- **WHEN** the user chooses Exit while no change is saving
- **THEN** the session with the device ends and the Connect screen is shown

#### Scenario: Exit during an edit

- **WHEN** the user chooses Exit while an edit is being saved
- **THEN** the edit finishes first, then the session ends and the Connect screen is shown
