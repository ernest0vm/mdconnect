# Spec Delta

## ADDED Requirements

### Requirement: Web device selection

In the web app, a device request SHALL use the browser's own device chooser, filtered to supported NetMD and Hi-MD devices. Closing the chooser without choosing a device SHALL fail the request as "no device found", whether or not the chooser listed any device, because the browser reports both cases identically. The message SHALL also invite the user to pick the device in the browser's list.

#### Scenario: Browser chooser lists only MiniDisc devices

- **WHEN** a supported device and a non-MiniDisc USB device are connected and the user clicks "Connect device" in the web app
- **THEN** the browser's chooser opens and lists only the supported device

#### Scenario: Chooser closed with a device listed

- **WHEN** the browser's chooser lists a supported device and the user closes it without choosing
- **THEN** the Connect screen shows the "no device found" message, including the hint to pick the device in the browser's list, and no device is opened

#### Scenario: Chooser with no devices

- **WHEN** no supported device is connected and the user opens and closes the browser's chooser
- **THEN** the Connect screen shows the same "no device found" message

### Requirement: Web reconnect for granted devices

In the web app, a supported device the user granted in this browser SHALL be listable without a prompt on later visits while it stays connected. Devices never granted SHALL require the chooser.

#### Scenario: Return visit

- **WHEN** a user who granted a device earlier reloads the web app with that device connected
- **THEN** the device is shown as available without opening the chooser

#### Scenario: Never granted

- **WHEN** a supported device is connected but was never granted in this browser
- **THEN** the web app does not list it until the user picks it in the chooser

#### Scenario: Device unplugged

- **WHEN** the selected device is unplugged while the web app is open
- **THEN** the UI is notified and shows that no device is connected
