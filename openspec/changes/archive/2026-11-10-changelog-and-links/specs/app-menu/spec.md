# Spec Delta

## MODIFIED Requirements

### Requirement: Menu

When a device is connected, the header SHALL offer a "More" menu with Export titles to CSV, Import titles from CSV, Wipe disc, About, Changelog, Support and FAQ, Source code on GitHub, Donate and Exit. Support and FAQ, Source code on GitHub and Donate SHALL open their pages in the user's default browser. The menu SHALL be operable with the keyboard alone, and an item that is unavailable SHALL say why.

#### Scenario: Open with the keyboard

- **WHEN** the user focuses More, presses Enter and moves with the arrow keys
- **THEN** each available item can be reached and chosen; an unavailable item is skipped and shows why under its name, and Escape closes the menu and returns focus to More

#### Scenario: Focus after a dialog

- **WHEN** the user closes a dialog opened from the menu, such as About
- **THEN** focus returns to More

#### Scenario: Unavailable item

- **WHEN** the disc is write-protected
- **THEN** Wipe disc and Import titles from CSV are unavailable, and the menu says the disc is write-protected

#### Scenario: Open a link

- **WHEN** the user chooses Donate in the desktop app
- **THEN** https://paypal.me/ernest0vm opens in the default browser and the app window keeps showing the app

### Requirement: About

About SHALL show the app version and the build commit, or say that it is a development build, state that mdconnect is free software under GPL-2.0 with a link to its source, and credit webminidisc and netmd-js with their authors.

#### Scenario: About

- **WHEN** the user chooses About
- **THEN** a dialog shows the version, the build commit, the GPL-2.0 notice with the source link, and the credits
