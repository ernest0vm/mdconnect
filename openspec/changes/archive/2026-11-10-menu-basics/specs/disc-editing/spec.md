# Spec Delta

## ADDED Requirements

### Requirement: Wipe disc

The app SHALL erase every track and title on the disc only after the user confirms a dialog. The dialog SHALL name the disc and say that every track will be erased and cannot be recovered. Playback SHALL stop first. Wipe disc SHALL be unavailable while the disc is write-protected or a change is being saved.

#### Scenario: Wipe after confirming

- **WHEN** the user chooses Wipe disc on "Mix" and confirms
- **THEN** playback stops, the disc is erased and read again, and it shows as blank

#### Scenario: Cancel wiping

- **WHEN** the user chooses Wipe disc and cancels
- **THEN** nothing is sent to the device

#### Scenario: Write-protected disc

- **WHEN** the disc is write-protected
- **THEN** Wipe disc is unavailable and says the disc is write-protected
