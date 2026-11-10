# disc-csv Specification

## Purpose

Defines how mdconnect exports a disc's titles and groups to a CSV file and imports them back, in the format webminidisc uses, so title lists move between the two apps.

## Requirements

### Requirement: Export titles

Export titles to CSV SHALL save a CSV file in webminidisc's format, named after the disc title. It SHALL have:

- the header row webminidisc writes;
- a row for the disc (index 0);
- one row per track with its index, group range, group names, track names, duration and mode.

#### Scenario: Export a grouped disc

- **WHEN** the user exports a disc titled "Mix" with tracks 1 and 2 in the group "Side A"
- **THEN** a file "Mix.csv" is saved with a disc row "Mix" and rows for tracks 1 and 2 that carry the group "Side A"

#### Scenario: Commas in titles

- **WHEN** a track title contains a comma, such as "Love, Actually"
- **THEN** the comma is written as `\,`, as webminidisc does, and the title reads back unchanged on import

### Requirement: Import titles

Import titles from CSV SHALL read webminidisc's format, current or older, and apply its disc title, track titles and groups to the disc as one edit, after a review.

#### Scenario: Import onto a matching disc

- **WHEN** the user imports a CSV exported from the same disc, after renaming tracks on the disc
- **THEN** the review reports no mismatch in track count, durations or modes, and after confirming, the disc has the titles and groups from the file

#### Scenario: Older format

- **WHEN** the file has webminidisc's older 8-column header, without album, artist and bitrate
- **THEN** it is read the same way

### Requirement: Import review

Before writing, the app SHALL show what the import will change. It SHALL list:

- a difference in track count;
- each track whose duration differs by 2 seconds or more;
- each track whose mode differs.

The user SHALL be able to skip the listed tracks or cancel. A file that is not a CSV in a supported format SHALL be refused with a readable message.

#### Scenario: Different track count

- **WHEN** the file describes 12 tracks and the disc has 10
- **THEN** the review says so and that tracks 11 and 12 of the file will be ignored

#### Scenario: Skipped track

- **WHEN** the user imports without ticking a mismatched track
- **THEN** that track keeps its title

#### Scenario: Mismatched track

- **WHEN** the file describes track 3 as a 4:00 SP track and the disc's track 3 is a 2:10 LP2 track
- **THEN** the review lists track 3 with both descriptions, and the user can label it anyway or skip it

#### Scenario: Not a supported file

- **WHEN** the user picks a file whose first row is not a supported header
- **THEN** the app says the file is not a title list it can read, and nothing is changed

### Requirement: Import fits the disc

An import SHALL be refused, with a readable message, when its titles and groups would not fit in the disc's title space. Nothing SHALL be written in that case.

#### Scenario: Too many characters

- **WHEN** the imported titles need more title space than the disc has
- **THEN** the app says the titles do not fit, and the disc is unchanged
