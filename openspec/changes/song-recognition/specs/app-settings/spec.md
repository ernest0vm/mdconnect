# Spec Delta

## MODIFIED Requirements

### Requirement: Settings dialog

Every screen, in the desktop app and in the web app, SHALL offer a Settings control that opens a dialog with four sections: Appearance, Titles, Uploads and Song recognition. A change SHALL apply immediately and be remembered, with no Save button. The dialog SHALL be operable with the keyboard alone and SHALL return focus to the Settings control when it closes.

#### Scenario: Open from the Connect screen

- **WHEN** no device is connected and the user chooses Settings
- **THEN** the dialog opens with the Appearance, Titles, Uploads and Song recognition sections

#### Scenario: Keyboard only

- **WHEN** the user focuses Settings with Tab, presses Enter, changes a choice with the keyboard and presses Escape
- **THEN** the choice applies, the dialog closes, and focus returns to Settings

## ADDED Requirements

### Requirement: Withdraw recognition consent

The Song recognition section SHALL list Shazam, AcoustID and MusicBrainz, say for each whether the user has agreed to send data to it, and let them withdraw each consent separately. After a withdrawal, the next use of that service SHALL ask again.

#### Scenario: Withdraw one service

- **WHEN** the user agreed to Shazam and AcoustID and withdraws the consent to Shazam
- **THEN** Settings says Shazam has no consent and AcoustID still has it, and the next identification with Shazam asks again

#### Scenario: Nothing to withdraw

- **WHEN** the user never agreed to MusicBrainz
- **THEN** Settings says MusicBrainz has no consent and offers no withdraw action for it
