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

These paths follow electron-builder's defaults; they are confirmed on a real Linux install as part of scaffold-desktop-app task 11.4.

The rule file is generated from the supported device table (`packages/core/src/devices.ts`); a unit test fails if the two drift apart.

## Verified hardware

| OS         | Device | Result | Notes                                                                     |
| ---------- | ------ | ------ | ------------------------------------------------------------------------- |
| _none yet_ |        |        | Filled in during hardware verification (scaffold-desktop-app tasks 11.x). |
