# Spec Delta

## MODIFIED Requirements

### Requirement: Read the disc after connecting

When a NetMD device connects, in the desktop app or the web app, the app SHALL read the inserted disc without further user action and show its contents. While reading, it SHALL show a reading state. It SHALL offer a Refresh action that reads the disc again. After each edit to the disc, successful or not, it SHALL read the disc again so the screen shows what the device stored.

#### Scenario: Disc read on connect

- **WHEN** the user connects a NetMD device with a recorded disc inserted
- **THEN** the screen shows a reading state, then the disc title and its tracks

#### Scenario: Refresh after changing discs

- **WHEN** the user swaps the disc in the connected device and clicks Refresh
- **THEN** the screen shows the contents of the new disc

#### Scenario: Read again after an edit

- **WHEN** an edit to the disc finishes, whether it succeeded or failed
- **THEN** the disc is read again and the screen shows the contents the device reports
