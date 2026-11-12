import { isSupportedDevice } from '@mdconnect/core';
import { ipcMain, type Session } from 'electron';

type PermissionDevice = Electron.DevicePermissionHandlerHandlerDetails['device'];

import { IPC } from '../shared/ipc';
import { routeDeviceSelection, type ChooserBridge } from './chooser-bridge';
import { isAppOrigin, type OriginContext } from './url-policy';

/**
 * The main process alone decides which USB devices the renderer may use: only supported MiniDisc
 * devices, and only for the app's own origin. The `usb` permission check is in permissions.ts.
 */
export function installUsbHandlers(
  session: Session,
  bridge: ChooserBridge,
  origins: OriginContext,
): void {
  session.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'usb' || !isAppOrigin(details.origin, origins)) return false;
    const { device } = details;
    return isUsbDevice(device) && isSupportedDevice(device.vendorId, device.productId);
  });

  session.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    routeDeviceSelection(details.deviceList, callback, bridge);
  });

  ipcMain.on(IPC.deviceChosen, (event, payload: unknown) => {
    const senderOrigin = event.senderFrame?.origin ?? '';
    if (!isAppOrigin(senderOrigin, origins)) return;
    if (typeof payload !== 'object' || payload === null) return;
    const { requestId, deviceId } = payload as Record<string, unknown>;
    bridge.respond(requestId, deviceId);
  });
}

/** HID devices and serial ports share the handler; only USB devices carry a USB version. */
function isUsbDevice(device: PermissionDevice): device is Electron.USBDevice {
  return 'usbVersionMajor' in device;
}
