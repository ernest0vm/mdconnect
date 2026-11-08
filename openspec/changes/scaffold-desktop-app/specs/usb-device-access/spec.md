# Spec Delta

## Purpose

Controls how the app reaches MiniDisc hardware over WebUSB: which devices the UI may open, how one is chosen, how known devices are found again, and what the user sees when access fails on each OS.

## ADDED Requirements

### Requirement: Known MiniDisc devices only

The UI SHALL only be able to access USB devices whose vendor and product IDs appear in the app's list of supported NetMD and Hi-MD devices. All other USB devices SHALL be inaccessible, and USB access SHALL be refused to any origin other than the app's own.

#### Scenario: Supported device

- **WHEN** a supported device (for example Sony MZ-N510/N610, vendor `0x054c`, product `0x00c9`) is connected and the UI requests a MiniDisc device
- **THEN** the device is available to the UI

#### Scenario: Unsupported device

- **WHEN** only a non-MiniDisc USB device (for example a keyboard) is connected and the UI requests a device
- **THEN** no device is returned and the request fails as "no device found"

#### Scenario: Foreign origin

- **WHEN** content from any origin other than the app's requests USB access
- **THEN** access is denied

### Requirement: Supported device list

The supported device list SHALL include every NetMD device listed by upstream `netmd-js` 4.4.1 and every Hi-MD device listed by upstream `himd-js` 0.2.15, each with its display name, and SHALL credit those projects as the source.

#### Scenario: Name lookup

- **WHEN** a device with vendor `0x054c` and product `0x0286` is connected
- **THEN** the app identifies it as "Sony MZ-RH1"

#### Scenario: Hi-MD mode ID

- **WHEN** a device with vendor `0x054c` and product `0x0287` is connected
- **THEN** the app identifies it as a supported Hi-MD device named "Sony MZ-RH1"

### Requirement: Device selection without a browser prompt

A device request SHALL resolve without any browser-style chooser. With one matching device connected it SHALL be selected automatically. With several, the app SHALL ask the user to pick one in its own UI. With none, the request SHALL fail as "no device found".

#### Scenario: Exactly one device

- **WHEN** one supported device is connected and the user clicks "Connect device"
- **THEN** that device is selected with no further prompt

#### Scenario: Several devices

- **WHEN** two supported devices are connected and the user clicks "Connect device"
- **THEN** the app lists both by name and waits for the user to choose one
- **AND** the chosen device is returned to the request

#### Scenario: Several devices of the same model

- **WHEN** two connected devices have the same name and USB IDs
- **THEN** each entry also shows the device's serial number when it reports one
- **AND** when serial numbers are missing or identical, entries are numbered in the order the list presents them and the dialog suggests unplugging the other device, then cancelling and connecting again, to be certain which one is chosen (the open list does not update when a device is unplugged)

#### Scenario: User cancels the choice

- **WHEN** the app is asking the user to choose between devices and the user cancels
- **THEN** the request fails as "cancelled" and no device is opened

#### Scenario: No device

- **WHEN** no supported device is connected and the user clicks "Connect device"
- **THEN** the request fails as "no device found"

### Requirement: Reconnect without prompting

Supported devices that are connected SHALL be listable by the UI without any prompt, including right after the app starts, so the app can reconnect to a device it used before.

#### Scenario: Device already plugged in at launch

- **WHEN** a supported device is connected and the app starts
- **THEN** the UI can list the device without user interaction

#### Scenario: Device plugged in while running

- **WHEN** a supported device is plugged in while the app is open
- **THEN** the UI is notified and can list it without a prompt

#### Scenario: Device unplugged

- **WHEN** the selected device is unplugged
- **THEN** the UI is notified and shows that no device is connected

### Requirement: Connect screen

The app SHALL show a "Connect device" screen. After a successful request it SHALL show the device name and its vendor and product IDs in hexadecimal. After a failure it SHALL show a readable message for the failure kind instead of a raw error.

#### Scenario: Connected

- **WHEN** the user connects a Sony MZ-N510/N610 (vendor `0x054c`, product `0x00c9`)
- **THEN** the screen shows "Sony MZ-N510/N610" and `054c:00c9`

#### Scenario: Failure message

- **WHEN** a request fails as "no device found"
- **THEN** the screen explains that no supported MiniDisc device was found and suggests checking the cable and that the device is in NetMD or Hi-MD mode

### Requirement: OS-specific access guidance

When a supported device is found but cannot be opened, the app SHALL show setup guidance for the current OS: the USB driver step on Windows and the device permission (udev) step on Linux. On macOS it SHALL suggest closing other apps that may hold the device.

#### Scenario: Windows driver missing

- **WHEN** opening a supported device fails on Windows
- **THEN** the message explains that a USB driver must be installed for the device and links to the setup instructions

#### Scenario: Linux permission denied

- **WHEN** opening a supported device fails with access denied on Linux
- **THEN** the message explains that the user needs permission for the device and links to the udev setup instructions

#### Scenario: macOS device busy

- **WHEN** opening a supported device fails on macOS
- **THEN** the message suggests closing other apps that may be using the device and reconnecting it
