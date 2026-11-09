# Platform setup

mdconnect talks to MiniDisc devices over WebUSB. macOS works out of the box; Windows and Linux need a one-time setup so the app is allowed to open the device. The in-app error messages link to the community guide, which covers the same steps: <https://www.minidisc.wiki/guides/webminidisc/requirements>.

## macOS

No setup is needed. NetMD devices use a vendor-specific USB interface, so no system driver claims them.

If connecting fails with "Device busy", quit other apps that may be using the device (for example another MiniDisc tool), unplug the device and plug it back in.

The installer is unsigned for now. The first time, right-click `mdconnect.app` and choose **Open** to get past Gatekeeper.

## Windows

Chromium's WebUSB, which Electron uses, can only open devices that use the **WinUSB** driver, and MiniDisc devices do not install it themselves. Install it once per device model:

1. Download [Zadig](https://zadig.akeo.ie/) and run it as an administrator.
2. Connect the MiniDisc device and switch it to NetMD mode if it has one.
3. In Zadig, choose **Options → List All Devices**, then select the MiniDisc device.
4. Select **WinUSB** as the target driver and click **Install Driver** (or **Replace Driver**).
5. Restart mdconnect and connect again.

The installer is unsigned for now, so Windows SmartScreen shows a warning; choose **More info → Run anyway**.

## Linux

Your user needs read/write access to the USB device node. mdconnect ships a udev rule (`60-mdconnect.rules`) that grants it to the logged-in user for every supported device (`uaccess`). Copy it into `/etc/udev/rules.d/` from wherever you have mdconnect:

- **`.deb` package** (installs to `/opt/mdconnect`):

  ```bash
  sudo cp /opt/mdconnect/resources/linux/60-mdconnect.rules /etc/udev/rules.d/
  ```

- **AppImage**: extract just the rule next to the AppImage, then copy it:

  ```bash
  ./mdconnect-*.AppImage --appimage-extract 'resources/linux/60-mdconnect.rules'
  ```

  ```bash
  sudo cp squashfs-root/resources/linux/60-mdconnect.rules /etc/udev/rules.d/
  ```

- **Source checkout**:

  ```bash
  sudo cp apps/desktop/resources/linux/60-mdconnect.rules /etc/udev/rules.d/
  ```

Then reload the rules, and unplug the device and plug it back in:

```bash
sudo udevadm control --reload && sudo udevadm trigger
```

The `.deb` path was verified by inspecting a built package (`/opt/mdconnect/resources/linux/60-mdconnect.rules`). The AppImage extraction command matches the packaged layout but has not yet been run against a built AppImage; that, and installing and connecting on a real Linux machine, is still open as scaffold-desktop-app task 11.4.

The rule file is generated from the supported device table (`packages/core/src/devices.ts`); a unit test fails if the two drift apart.

## Web app (browsers)

- **Supported browsers:** Google Chrome, Microsoft Edge, Opera and other Chromium-based browsers. Firefox and Safari do not implement WebUSB; the web app shows an explanation and a link to the desktop app instead.
- **Secure context:** WebUSB only works over HTTPS (or on `localhost`). Opening the app over plain HTTP from another machine shows the unsupported-browser screen.
- **Device permissions:** the browser asks you to pick the device the first time and remembers the grant for this site. Revoke it in the browser's site settings (in Chrome: `chrome://settings/content/usbDevices`).
- **Hi-MD mode:** the web app offers NetMD devices only. Hi-MD devices work when switched to NetMD mode; mdconnect does not support Hi-MD mode yet.
- **The OS setup above still applies:** the WinUSB driver on Windows and the udev rule on Linux are needed in the browser too.
- **Linux Snap or Flatpak browsers** run sandboxed and may not see USB devices even with the udev rule. Use a browser installed from your distribution's packages, or the desktop app.

## Verified hardware

| OS                           | Device                                    | Result | Notes                                                                                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS 27.0.1 (Apple Silicon) | Sony MZ-NE410/NF520D (NetMD, `054c:00ca`) | Works  | Desktop app, development build: connect shows name and IDs; unplug returns to the Connect prompt; replug and relaunch reconnect without the chooser. Packaged `.app`: reconnects on launch, and a Connect request returns and opens the device. |
| macOS 27.0.1 (Apple Silicon) | Sony MZ-NE410/NF520D (NetMD, `054c:00ca`) | Works  | Web app in Google Chrome (https://mdconnect.vercel.app): picking the device in Chrome's chooser shows name and IDs. Reload, cancel and unplug not checked yet (add-web-app task 6.1).                                                           |
