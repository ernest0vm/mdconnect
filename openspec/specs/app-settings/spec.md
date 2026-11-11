# app-settings Specification

## Purpose

Defines mdconnect's Settings dialog: where it is offered, which choices it holds, and how those choices are stored and applied across the app.

## Requirements

### Requirement: Settings dialog

Every screen, in the desktop app and in the web app, SHALL offer a Settings control that opens a dialog with three sections: Appearance, Titles and Uploads. A change SHALL apply immediately and be remembered, with no Save button. The dialog SHALL be operable with the keyboard alone and SHALL return focus to the Settings control when it closes.

#### Scenario: Open from the Connect screen

- **WHEN** no device is connected and the user chooses Settings
- **THEN** the dialog opens with the Appearance, Titles and Uploads sections

#### Scenario: Keyboard only

- **WHEN** the user focuses Settings with Tab, presses Enter, changes a choice with the keyboard and presses Escape
- **THEN** the choice applies, the dialog closes, and focus returns to Settings

### Requirement: Settings location

The Settings control SHALL be in the header on the disc screen, and next to the footer on screens without a header: the Connect screen and the unsupported-browser page.

#### Scenario: Disc screen

- **WHEN** a device is connected and its disc is shown
- **THEN** Settings is in the header, next to More

### Requirement: Full-width titles setting

The Titles section SHALL offer "Full-width titles", on by default. When it is off, the rename dialogs and the convert dialog SHALL hide their full-width title fields, and the app SHALL leave full-width titles already on the disc unchanged. Full-width titles SHALL still be shown in the track list.

#### Scenario: Turned off

- **WHEN** the user turns Full-width titles off and renames a track that has the full-width title "夜明け"
- **THEN** the rename dialog shows only the half-width field, and after saving the track still has "夜明け"

#### Scenario: Default

- **WHEN** the app runs for the first time
- **THEN** the rename dialogs show the full-width field

### Requirement: Upload defaults

The Uploads section SHALL set the defaults the convert dialog starts with: recording mode, title source, ReplayGain and LP encoder. These SHALL be the same stored choices the convert dialog remembers, so a change in either place shows in the other.

#### Scenario: Default mode from Settings

- **WHEN** the user picks LP4 in Settings and then adds tracks
- **THEN** the convert dialog starts with LP4 selected

#### Scenario: Change in the convert dialog

- **WHEN** the user uploads in LP2 from the convert dialog and then opens Settings
- **THEN** Settings shows LP2 as the default recording mode

### Requirement: When convert dialog choices are stored

The convert dialog SHALL store its recording mode, title source, ReplayGain and encoder as the new defaults when the user starts the upload, and a cancelled dialog SHALL leave the stored defaults unchanged. Full-width titles and consent to the online encoder SHALL be stored as soon as the user changes them in the dialog.

#### Scenario: Cancelled convert dialog

- **WHEN** the user picks LP4 in the convert dialog and cancels it
- **THEN** Settings still shows the earlier default recording mode

### Requirement: Withdraw online-encoder consent

The Uploads section SHALL say whether the user has agreed to send audio to the online encoder, and SHALL let them withdraw that consent. After a withdrawal, the next upload with the online encoder SHALL ask again.

#### Scenario: Withdraw

- **WHEN** the user agreed earlier and now chooses "Withdraw consent" in Settings
- **THEN** Settings says no consent is given, and the next online upload shows the consent notice again

#### Scenario: Nothing to withdraw

- **WHEN** the user never agreed
- **THEN** Settings says no consent is given and offers no withdraw action
