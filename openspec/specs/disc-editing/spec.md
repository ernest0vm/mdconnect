# disc-editing Specification

## Purpose

Defines how mdconnect changes the disc in a connected NetMD device: disc, track and group titles, deleting and reordering tracks, and grouping them, with the limits and states that keep a disc consistent.

## Requirements

### Requirement: Rename the disc

The app SHALL let the user change the disc title, with a half-width title and an optional full-width (Japanese) title. Renaming SHALL keep the disc's groups. Clearing the title SHALL leave the disc untitled.

#### Scenario: Rename a disc

- **WHEN** the user renames a disc titled "Mix" to "Road trip" and saves
- **THEN** the disc title shows "Road trip" after the disc is read again

#### Scenario: Rename a grouped disc

- **WHEN** the user renames a disc whose tracks 1 and 2 are in the group "Side A"
- **THEN** the disc shows the new title and tracks 1 and 2 are still under "Side A"

#### Scenario: Clear the disc title

- **WHEN** the user empties the disc title and saves
- **THEN** the disc is shown as untitled

### Requirement: Rename a track

The app SHALL let the user change a track's title, with a half-width title and an optional full-width title.

#### Scenario: Rename a track

- **WHEN** the user renames track 3 to "Intro" and saves
- **THEN** track 3 shows "Intro" after the disc is read again

#### Scenario: Full-width track title

- **WHEN** the user sets track 1's full-width title to "夜明け"
- **THEN** track 1 shows "夜明け" after the disc is read again

### Requirement: Title conversion

Before saving, the app SHALL convert each title to characters the disc can store, as webminidisc does, and SHALL show the converted title in the dialog. Half-width titles keep ASCII and half-width katakana; other characters lose diacritics or become spaces. Full-width titles keep Shift-JIS characters.

#### Scenario: Accented title

- **WHEN** the user types the half-width track title "Te Lloré un Río"
- **THEN** the dialog shows that "Te Llore un Rio" will be saved, and that is what the disc stores

#### Scenario: Unsupported character

- **WHEN** a half-width title contains "★"
- **THEN** the dialog shows a space in its place before saving

### Requirement: Title space

The app SHALL show how many characters remain on the disc for half-width and for full-width titles once the edited titles replace the current ones, and SHALL NOT save titles that do not fit in that space.

#### Scenario: Title too long for the disc

- **WHEN** the user enters a title that, replacing the current one, needs more title space than the disc has
- **THEN** the dialog says the title does not fit and Save is disabled

#### Scenario: Replacing a title on a full disc

- **WHEN** the disc has no title space left and the user renames a track from "Old" to "New"
- **THEN** the new title fits, because it takes no more space than the title it replaces

### Requirement: Select tracks

The track list SHALL let the user select one or more tracks, select all, and clear the selection, by pointer and by keyboard. Actions that work on tracks SHALL apply to the selected tracks and SHALL say how many are selected.

#### Scenario: Select several tracks

- **WHEN** the user selects tracks 2 and 4
- **THEN** both rows are marked as selected and the toolbar shows that 2 tracks are selected

#### Scenario: Select all

- **WHEN** the user chooses Select all on a 12-track disc
- **THEN** all 12 tracks are selected

### Requirement: Delete tracks

The app SHALL delete the selected tracks only after the user confirms a dialog that states how many tracks will be erased and that this cannot be undone. Remaining tracks SHALL keep their groups.

#### Scenario: Delete after confirming

- **WHEN** the user selects tracks 2 and 3 of a 5-track disc, chooses Delete and confirms
- **THEN** the disc has 3 tracks, formerly tracks 1, 4 and 5, in that order

#### Scenario: Cancel deleting

- **WHEN** the user chooses Delete and then cancels the confirmation
- **THEN** no track is erased

#### Scenario: Groups after deleting

- **WHEN** tracks 1 to 3 are in the group "Side A" and the user deletes track 2
- **THEN** the remaining two tracks of "Side A" are still under "Side A"

### Requirement: Move tracks

The app SHALL let the user move a track to another position by dragging it and, as a keyboard alternative, by moving it up or down one position. A moved track SHALL stay in its group when it lands next to another track of that group; otherwise it SHALL join the group it lands inside, or no group.

#### Scenario: Drag a track

- **WHEN** the user drags track 5 to position 2
- **THEN** after the disc is read again, the former track 5 is track 2 and the former tracks 2 to 4 are tracks 3 to 5

#### Scenario: Move with the keyboard

- **WHEN** track 3 has focus and the user chooses Move up
- **THEN** it becomes track 2 and keeps focus

#### Scenario: Move into a group

- **WHEN** the user drags a track that is in no group between two tracks of the group "Side A"
- **THEN** the moved track is shown under "Side A"

#### Scenario: Move out of a group

- **WHEN** tracks 1 and 2 are in "Side A" and the user drags track 1 to the end of a 4-track disc, away from "Side A"
- **THEN** the moved track is in no group and the former track 2 is the only track of "Side A"

#### Scenario: Move to the edge of its group

- **WHEN** tracks 1 to 3 are in "Side A" and the user moves track 1 to position 3
- **THEN** it is still under "Side A", as its last track

### Requirement: Groups

The app SHALL let the user group the selected tracks under a new title, rename a group with a half-width and an optional full-width title, and ungroup a group. Grouping SHALL require consecutive tracks that are not in another group. Ungrouping SHALL keep the tracks on the disc.

#### Scenario: Group tracks

- **WHEN** the user selects tracks 4 to 6, none of them grouped, and groups them as "Live"
- **THEN** tracks 4 to 6 are shown under "Live"

#### Scenario: Non-consecutive selection

- **WHEN** the user selects tracks 1 and 3 only
- **THEN** grouping is unavailable and the app says the tracks must be consecutive

#### Scenario: Ungroup

- **WHEN** the user ungroups "Live"
- **THEN** its tracks remain on the disc, outside any group

### Requirement: When editing is unavailable

Editing actions SHALL be disabled, with a short reason, while the disc is write-protected and while a read or another edit is in progress. Only one edit SHALL run at a time.

#### Scenario: Write-protected disc

- **WHEN** a write-protected disc is shown
- **THEN** rename, delete, move and group actions are disabled and the screen says the disc is write-protected

#### Scenario: Edit in progress

- **WHEN** an edit is being written to the disc
- **THEN** the other editing actions are disabled until it finishes

### Requirement: Failed edits

When the device rejects or does not answer an edit, the app SHALL show a readable message, read the disc again and show what the disc actually holds. If the device is unplugged during an edit, the Connect screen SHALL return as for any unplug.

#### Scenario: Device rejects an edit

- **WHEN** the device rejects a rename
- **THEN** the screen says the change could not be saved and shows the disc as read again

#### Scenario: Unplugged while editing

- **WHEN** the device is unplugged while an edit is being written
- **THEN** the Connect screen returns, as for any unplug
