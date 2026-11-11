# ui-theme Specification

## Purpose

Defines the shared visual foundation of mdconnect: a glass-styled look that follows the operating system's appearance and accessibility settings, so every screen ported later looks and behaves consistently.

## Requirements

### Requirement: Follow OS appearance

While the theme choice is "System", the app SHALL use a light or dark appearance matching the OS setting at launch, and SHALL switch automatically when the OS setting changes while the app is open. When the user picked Light or Dark in the app, that theme SHALL apply regardless of the OS setting.

#### Scenario: Dark OS at launch

- **WHEN** the OS is set to dark mode, the theme choice is "System" and the app starts
- **THEN** the app renders in its dark appearance

#### Scenario: OS switches while running

- **WHEN** the theme choice is "System" and the OS appearance changes from light to dark while the app is open
- **THEN** the app switches to its dark appearance without a restart

#### Scenario: Theme picked in the app

- **WHEN** the user picked Light in the app and the OS is set to dark mode
- **THEN** the app renders in its light appearance, and stays light when the OS appearance changes

### Requirement: Readable contrast

Body text and interactive controls SHALL meet WCAG 2.2 AA contrast (4.5:1 for normal text, 3:1 for large text and control boundaries) in both appearances, including text drawn on translucent glass surfaces.

#### Scenario: Text on glass

- **WHEN** body text is shown on a translucent surface in either appearance
- **THEN** its contrast ratio against the rendered background is at least 4.5:1

### Requirement: Respect reduced motion and transparency

When the OS asks for reduced motion, the app SHALL disable non-essential animations. While the transparency choice is "System", glass surfaces SHALL become opaque when the OS reports a reduced-transparency preference through Electron or Chromium. On Linux desktops that expose no such preference, the default glass look is used. When the user picked Reduced or Glass in the app, that choice SHALL apply regardless of the OS preference.

#### Scenario: Reduced motion

- **WHEN** the OS "reduce motion" setting is on
- **THEN** opening a dialog shows it without a transition animation

#### Scenario: Reduced transparency

- **WHEN** the transparency choice is "System", the OS "reduce transparency" setting is on and the OS reports it to the app (macOS "Reduce transparency", Windows "Transparency effects" off)
- **THEN** panels and dialogs render with an opaque background and no blur

#### Scenario: Preference not reported

- **WHEN** the transparency choice is "System" and a Linux desktop exposes no reduced-transparency preference to Electron or Chromium
- **THEN** the default glass look is used, and the tested desktop is recorded in the platform setup docs

#### Scenario: Transparency picked in the app

- **WHEN** the user picked Reduced in the app while the OS reports no reduced-transparency preference
- **THEN** panels and dialogs render with an opaque background and no blur

### Requirement: Keyboard operable

Every interactive control SHALL be reachable and operable with the keyboard and SHALL show a visible focus indicator in both appearances.

#### Scenario: Keyboard connect

- **WHEN** the user presses Tab until the "Connect device" button is focused and presses Enter
- **THEN** the button shows a visible focus ring and a device request starts

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

### Requirement: Remember the appearance choice

The app SHALL remember the theme and transparency choices and apply them at the next launch: per browser profile and site in the web app, and per OS user in the desktop app. A missing, unreadable or invalid stored value SHALL fall back to "System" for that choice without an error shown to the user.

#### Scenario: Choice survives a restart

- **WHEN** the user picked Dark and Reduced, then closes and reopens the app
- **THEN** the app starts in its dark appearance with opaque panels

#### Scenario: Corrupt stored value

- **WHEN** the stored appearance value cannot be parsed or holds an unknown option
- **THEN** the affected choice is "System" and the app starts normally
