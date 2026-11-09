# desktop-shell Specification

## Purpose

Defines the desktop application container: how mdconnect starts on macOS, Windows and Linux, what the UI code is allowed to do, and how the app is built into installable packages.

## Requirements

### Requirement: Single main window

The app SHALL open one main window on launch on macOS, Windows and Linux. A second launch while the app is running SHALL NOT start another instance; it SHALL restore and focus the existing main window, or open one if none exists (for example on macOS after the window was closed).

#### Scenario: First launch

- **WHEN** the user starts mdconnect and no instance is running
- **THEN** one main window opens showing the app UI

#### Scenario: Second launch

- **WHEN** the user starts mdconnect while an instance is already running with its main window open
- **THEN** no new instance or additional window is created
- **AND** the existing window is restored if minimized and brought to the front

#### Scenario: Second launch with no window on macOS

- **WHEN** the user closes the main window on macOS (the app keeps running) and starts mdconnect again
- **THEN** no new instance is created
- **AND** the running instance opens one main window and brings it to the front

#### Scenario: macOS window closed

- **WHEN** the user closes the main window on macOS and then clicks the dock icon
- **THEN** a main window is shown again

### Requirement: Isolated renderer

UI code SHALL run without access to Node.js or Electron APIs. It SHALL only reach privileged functionality through a small, explicitly exposed, typed API.

#### Scenario: Node.js is not reachable from UI code

- **WHEN** UI code checks for `require`, `process` or Electron modules
- **THEN** none of them are available

#### Scenario: Exposed API is the only bridge

- **WHEN** UI code inspects the privileged API exposed to it
- **THEN** it finds only the documented functions
- **AND** every value crossing the bridge (arguments, return values and event payloads) is plain serializable data, except that subscription functions take a callback and return an unsubscribe function

### Requirement: Content restrictions

In packaged builds the UI SHALL only execute scripts shipped inside the app. Remote scripts, inline scripts and string evaluation SHALL be blocked. WebAssembly compilation SHALL be allowed. Inline style attributes are permitted.

#### Scenario: Remote script is blocked

- **WHEN** the UI of a packaged build attempts to load a script from a remote origin
- **THEN** the load is refused and the app keeps working

#### Scenario: String evaluation is blocked

- **WHEN** UI code in a packaged build calls `eval` or `new Function` with a string
- **THEN** the call fails with a security error

### Requirement: Navigation lock

The main window SHALL never navigate away from the app and SHALL never open additional app windows. Links to `http` or `https` URLs SHALL open in the user's default browser; links with any other scheme SHALL be ignored.

#### Scenario: Web link

- **WHEN** the user activates a link to an `https` URL
- **THEN** the URL opens in the default system browser
- **AND** the app window still shows the app

#### Scenario: Navigation attempt

- **WHEN** the UI attempts to navigate the main window to any other page
- **THEN** the navigation is cancelled

#### Scenario: Unsupported scheme

- **WHEN** the UI attempts to open a `file:` or custom-scheme URL as a new window
- **THEN** nothing is opened

### Requirement: Offline app origin

In packaged builds the UI SHALL be served from a fixed, secure app origin bundled with the app, so it works with no network connection and keeps the same origin across launches and installs.

#### Scenario: Launch offline

- **WHEN** the packaged app starts on a machine with no network connection
- **THEN** the UI loads completely

#### Scenario: Stable origin

- **WHEN** UI code reads `location.origin` in two different launches of the packaged app
- **THEN** both report the same secure origin, which is not `file://` or `null`

### Requirement: Installable builds per OS

The project SHALL produce an unsigned installable build for the OS it is built on: a disk image for macOS, an installer for Windows, and both an AppImage and a Debian package for Linux.

#### Scenario: Build on each OS

- **WHEN** a developer runs the documented package command on macOS, Windows or Linux
- **THEN** the corresponding installable artifacts are written to the app's release output directory

#### Scenario: Installed build runs

- **WHEN** a user installs and opens an artifact from that build on the same OS
- **THEN** the app launches and shows the main window
