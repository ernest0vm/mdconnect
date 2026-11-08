import type { AppearancePayload, ChooseDeviceRequestPayload, DesktopOs } from './ipc';

/** The only privileged API the renderer sees, exposed by the preload as `window.mdconnect`. */
export interface MdconnectBridge {
  readonly os: DesktopOs;
  readonly usb: {
    onChooseDevice(callback: (request: ChooseDeviceRequestPayload) => void): () => void;
    respondChooseDevice(requestId: string, deviceId: string | null): void;
  };
  readonly appearance: {
    get(): AppearancePayload;
    onChange(callback: (signals: AppearancePayload) => void): () => void;
  };
}
