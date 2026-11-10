# Spec Delta

## MODIFIED Requirements

### Requirement: Appearance control

The Appearance section of Settings, which every screen offers in the desktop app and in the web app, SHALL let the user choose the theme (System, Light, Dark) and the transparency (System, Reduced, Glass). A change SHALL apply immediately, without a reload. The section SHALL be operable with the keyboard alone and SHALL announce the current choice of each group to assistive technology.

#### Scenario: Change theme from the control

- **WHEN** the user opens Settings and picks Dark in the Appearance section
- **THEN** the app switches to its dark appearance immediately, and the section shows Dark as the current theme

#### Scenario: Back to System

- **WHEN** the user picked Light earlier and now picks System while the OS is set to dark mode
- **THEN** the app switches to its dark appearance and follows the OS again

#### Scenario: Keyboard only

- **WHEN** the user focuses Settings with Tab and presses Enter, then uses the arrow keys and Space within each Appearance group
- **THEN** the dialog opens, each choice can be selected, and Escape closes the dialog and returns focus to Settings
