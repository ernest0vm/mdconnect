# usb-device-access Specification

## Purpose

Controls how mdconnect (desktop and web) reaches MiniDisc hardware over WebUSB: which devices the UI may open, how one is chosen, how known devices are found again, and what the user sees when access fails on each OS.

## Requirements

### Requirement: Known MiniDisc devices only

The UI SHALL only be able to access USB devices whose vendor and product IDs appear in the app's list of supported NetMD and Hi-MD devices. All other USB devices SHALL be inaccessible. In the desktop app, USB access SHALL also be refused to any origin other than the app's own.

#### Scenario: Supported device

- **WHEN** a supported device (for example Sony MZ-N510/N610, vendor `0x054c`, product `0x00c9`) is connected and the UI requests a MiniDisc device
- **THEN** the device is available to the UI

#### Scenario: Unsupported device

- **WHEN** only a non-MiniDisc USB device (for example a keyboard) is connected and the UI requests a device
- **THEN** no device is returned and the request fails as "no device found"

#### Scenario: Foreign origin

- **WHEN**, in the desktop app, content from any origin other than the app's requests USB access
- **THEN** access is denied

### Requirement: Supported device list

The supported device list SHALL include every NetMD device listed by upstream `netmd-js` 4.4.1 and every Hi-MD device listed by upstream `himd-js` 0.2.15, each with its display name, and SHALL credit those projects as the source.

#### Scenario: Name lookup

- **WHEN** a device with vendor `0x054c` and product `0x0286` is connected
- **THEN** the app identifies it as "Sony MZ-RH1"

#### Scenario: Hi-MD mode ID

- **WHEN** a device with vendor `0x054c` and product `0x0287` is connected
- **THEN** the app identifies it as a supported Hi-MD device named "Sony MZ-RH1"

### Requirement: Desktop device selection

In the desktop app, a device request SHALL resolve without any browser-style chooser. With one matching device connected it SHALL be selected automatically. With several, the app SHALL ask the user to pick one in its own UI. With none, the request SHALL fail as "no device found".

#### Scenario: Exactly one device

- **WHEN** one supported device is connected and the user clicks "Connect device" in the desktop app
- **THEN** that device is selected with no further prompt

#### Scenario: Several devices

- **WHEN** two supported devices are connected and the user clicks "Connect device" in the desktop app
- **THEN** the app lists both by name and waits for the user to choose one
- **AND** the chosen device is returned to the request

#### Scenario: Several devices of the same model

- **WHEN** two connected devices have the same name and USB IDs and the desktop app asks the user to choose
- **THEN** each entry also shows the device's serial number when it reports one
- **AND** when serial numbers are missing or identical, entries are numbered in the order the list presents them and the dialog suggests unplugging the other device, then cancelling and connecting again, to be certain which one is chosen (the open list does not update when a device is unplugged)

#### Scenario: User cancels the choice

- **WHEN** the app is asking the user to choose between devices and the user cancels
- **THEN** the request fails as "cancelled" and no device is opened

#### Scenario: No device

- **WHEN** no supported device is connected and the user clicks "Connect device" in the desktop app
- **THEN** the request fails as "no device found"

### Requirement: Desktop reconnect without prompting

In the desktop app, supported devices that are connected SHALL be listable by the UI without any prompt, including right after the app starts, so the app can reconnect to a device it used before.

#### Scenario: Device already plugged in at launch

- **WHEN** a supported device is connected and the desktop app starts
- **THEN** the UI can list the device without user interaction

#### Scenario: Device plugged in while running

- **WHEN** a supported device is plugged in while the desktop app is open
- **THEN** the UI is notified and can list it without a prompt

#### Scenario: Device unplugged

- **WHEN** the selected device is unplugged while the desktop app is open
- **THEN** the UI is notified and shows that no device is connected

### Requirement: Connect screen

Both apps SHALL show the same "Connect device" screen. After a successful request it SHALL show the device name and its vendor and product IDs in hexadecimal. After a failure it SHALL show a readable message for the failure kind instead of a raw error.

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

### Requirement: Web device selection

In the web app, a device request SHALL use the browser's own device chooser, filtered to the supported NetMD device IDs. Closing the chooser without choosing a device SHALL fail the request as "no device found", whether or not the chooser listed any device, because the browser reports both cases identically. The message SHALL invite the user to pick the device in the browser's list.

#### Scenario: Browser chooser lists only MiniDisc devices

- **WHEN** a supported NetMD device and a non-MiniDisc USB device are connected and the user clicks "Connect device" in the web app
- **THEN** the browser's chooser opens and lists only the NetMD device

#### Scenario: Chooser closed with a device listed

- **WHEN** the browser's chooser lists a supported device and the user closes it without choosing
- **THEN** the Connect screen shows the "no device found" message, including the hint to pick the device in the browser's list, and no device is opened

#### Scenario: Chooser with no devices

- **WHEN** no supported device is connected and the user opens and closes the browser's chooser
- **THEN** the Connect screen shows the same "no device found" message

### Requirement: Hi-MD mode is not supported on the web yet

The web app SHALL NOT offer Hi-MD-mode device IDs, which expose only the USB mass-storage class that WebUSB withholds from web pages. Its "no device found" message SHALL say mdconnect does not support Hi-MD mode yet and suggest NetMD mode, without claiming browsers cannot use Hi-MD mode or pointing to the desktop app. Hi-MD devices in NetMD mode SHALL work as NetMD devices.

#### Scenario: Device in Hi-MD mode

- **WHEN** only a Hi-MD device in Hi-MD mode (for example Sony MZ-RH1, vendor `0x054c`, product `0x0287`) is connected and the user clicks "Connect device" in the web app
- **THEN** the browser's chooser does not offer it
- **AND** after the chooser closes, the Connect screen shows the "no device found" message, including the note that mdconnect does not support Hi-MD mode yet

#### Scenario: Hi-MD device in NetMD mode

- **WHEN** a Sony MZ-RH1 connected in NetMD mode (product `0x0286`) is connected and the user picks it in the browser's chooser
- **THEN** the Connect screen shows "Sony MZ-RH1" and `054c:0286`

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

#### Scenario: Replug of a device without a USB serial number

- **WHEN** a device that reports no USB serial number is unplugged while the web app is open
- **THEN** the Connect screen says, naming the device, that after plugging it back in the user must click Connect device and pick it in the browser's list again, because the browser keeps the grant only while such a device stays connected

#### Scenario: Unplug where reconnecting needs no prompt

- **WHEN** a device with a USB serial number is unplugged in the web app, or any device is unplugged in the desktop app
- **THEN** no replug hint is shown
