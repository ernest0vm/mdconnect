# changelog Specification

## Purpose

Defines how mdconnect tells users what changed between versions: a changelog bundled with the app, a Changelog dialog, and a one-time "What's new" after an update.

## Requirements

### Requirement: Bundled changelog

The app SHALL include its changelog, with each version's number and list of changes, so the Changelog dialog works without a network connection.

#### Scenario: Offline

- **WHEN** the desktop app has no network connection and the user opens the Changelog
- **THEN** every version and its changes are listed

### Requirement: Changelog dialog

The Changelog item SHALL open a dialog listing every version, newest first, each with its changes. The dialog SHALL be operable with the keyboard alone and return focus to More when it closes.

#### Scenario: Open from the menu

- **WHEN** the user chooses Changelog in the More menu
- **THEN** a dialog lists the versions, the newest first

### Requirement: What's new after an update

When the app starts with a version newer than the last one the user saw, it SHALL open the changelog once, titled "What's new", showing only the versions added since then. A first start, with no version seen yet, SHALL show nothing and remember the current version. A start with the same version SHALL show nothing.

#### Scenario: After an update

- **WHEN** the last version seen is 0.1.0 and the app starts as 0.2.0
- **THEN** "What's new" opens once with the 0.2.0 changes, and does not open at the next start

#### Scenario: First install

- **WHEN** the app starts for the first time
- **THEN** no changelog opens

#### Scenario: Storage blocked

- **WHEN** the browser blocks storage
- **THEN** no changelog opens by itself, and the Changelog item still works
