# track-context-menu Specification

## Purpose

Defines the menu a track opens on right-click or from the keyboard: its items, when each is available, and how it relates to the selection.

## Requirements

### Requirement: Open a track's context menu

Right-clicking a track row, or pressing the context-menu key or Shift+F10 while a row has focus, SHALL open a menu for that track. If the track is not selected, it SHALL become the only selected track. Escape SHALL close the menu and return focus to the row.

#### Scenario: Right-click

- **WHEN** the user right-clicks track 5 while track 2 is selected
- **THEN** a menu opens for track 5, and track 5 is the only selected track

#### Scenario: Keyboard

- **WHEN** a row has focus and the user presses Shift+F10, then Escape
- **THEN** the menu opens for that track, then closes with focus back on the row

### Requirement: Track actions

The menu SHALL offer Play (Pause while the track plays), Rename, Delete, Move up and Move down. Each SHALL act on the track the menu was opened on, and only on that track, even when other tracks are selected. Each SHALL otherwise do what the matching player or toolbar action does, opening the same dialogs. Delete SHALL ask for confirmation as the toolbar's Delete does.

#### Scenario: Rename from the menu

- **WHEN** the user chooses Rename in track 3's menu
- **THEN** the rename dialog for track 3 opens

#### Scenario: Pause a playing track

- **WHEN** track 3 is playing and the user opens its menu
- **THEN** the first item is Pause, and choosing it pauses playback

### Requirement: Unavailable track actions

An action that cannot run SHALL be shown as unavailable with the reason, as in the More menu: editing actions while the disc is write-protected or a change or upload is in progress, Move up on the first track, Move down on the last, and Play when the player cannot be used.

#### Scenario: Write-protected disc

- **WHEN** the disc is write-protected, the player can be used, and the user opens a track's menu
- **THEN** Rename, Delete, Move up and Move down are unavailable with the write-protected reason, and Play is available

#### Scenario: First track

- **WHEN** the user opens the first track's menu
- **THEN** Move up is unavailable
