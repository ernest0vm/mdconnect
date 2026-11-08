import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import type { MdconnectBridge } from '../shared/bridge';
import {
  desktopOsFrom,
  IPC,
  type AppearancePayload,
  type ChooseDeviceRequestPayload,
} from '../shared/ipc';

let appearance = ipcRenderer.sendSync(IPC.appearanceGet) as AppearancePayload;
const appearanceListeners = new Set<(signals: AppearancePayload) => void>();

ipcRenderer.on(IPC.appearanceChanged, (_event, payload: AppearancePayload) => {
  appearance = payload;
  for (const listener of appearanceListeners) listener(payload);
});

const bridge: MdconnectBridge = {
  os: desktopOsFrom(process.platform),
  usb: {
    onChooseDevice(callback) {
      const listener = (_event: IpcRendererEvent, request: ChooseDeviceRequestPayload) => {
        callback(request);
      };
      ipcRenderer.on(IPC.chooseDevice, listener);
      return () => {
        ipcRenderer.removeListener(IPC.chooseDevice, listener);
      };
    },
    respondChooseDevice(requestId, deviceId) {
      ipcRenderer.send(IPC.deviceChosen, { requestId, deviceId });
    },
  },
  appearance: {
    get: () => appearance,
    onChange(callback) {
      appearanceListeners.add(callback);
      return () => {
        appearanceListeners.delete(callback);
      };
    },
  },
};

contextBridge.exposeInMainWorld('mdconnect', bridge);
