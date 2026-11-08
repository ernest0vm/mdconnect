# Spec Delta

## Purpose

Defines the shared visual foundation of mdconnect: a glass-styled look that follows the operating system's appearance and accessibility settings, so every screen ported later looks and behaves consistently.

## ADDED Requirements

### Requirement: Follow OS appearance

The app SHALL use a light or dark appearance matching the OS setting at launch, and SHALL switch automatically when the OS setting changes while the app is open.

#### Scenario: Dark OS at launch

- **WHEN** the OS is set to dark mode and the app starts
- **THEN** the app renders in its dark appearance

#### Scenario: OS switches while running

- **WHEN** the OS appearance changes from light to dark while the app is open
- **THEN** the app switches to its dark appearance without a restart

### Requirement: Readable contrast

Body text and interactive controls SHALL meet WCAG 2.2 AA contrast (4.5:1 for normal text, 3:1 for large text and control boundaries) in both appearances, including text drawn on translucent glass surfaces.

#### Scenario: Text on glass

- **WHEN** body text is shown on a translucent surface in either appearance
- **THEN** its contrast ratio against the rendered background is at least 4.5:1

### Requirement: Respect reduced motion and transparency

When the OS asks for reduced motion, the app SHALL disable non-essential animations. When the OS reports a reduced-transparency preference through Electron or Chromium, glass surfaces SHALL become opaque. On Linux desktops that expose no such preference, the default glass look is used.

#### Scenario: Reduced motion

- **WHEN** the OS "reduce motion" setting is on
- **THEN** opening a dialog shows it without a transition animation

#### Scenario: Reduced transparency

- **WHEN** the OS "reduce transparency" setting is on
- **THEN** panels and dialogs render with an opaque background and no blur

### Requirement: Keyboard operable

Every interactive control SHALL be reachable and operable with the keyboard and SHALL show a visible focus indicator in both appearances.

#### Scenario: Keyboard connect

- **WHEN** the user presses Tab until the "Connect device" button is focused and presses Enter
- **THEN** the button shows a visible focus ring and a device request starts
