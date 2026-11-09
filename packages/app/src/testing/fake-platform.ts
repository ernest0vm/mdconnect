import type {
  AppearanceSignals,
  ChooseDeviceRequest,
  Platform,
  PlatformUsb,
  UsbConnectionEventLike,
  UsbDeviceHandle,
} from '../platform';

type ConnectionListener = (event: UsbConnectionEventLike) => void;

export function fakeDevice(
  vendorId: number,
  productId: number,
  serialNumber?: string,
): UsbDeviceHandle {
  return {
    vendorId,
    productId,
    serialNumber,
    open: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
}

/** Test double for `navigator.usb`, with hooks to drive requests and connection events. */
export class FakeUsb implements PlatformUsb {
  connected: UsbDeviceHandle[] = [];
  requestedFilters: USBDeviceFilter[][] = [];
  nextRequest: () => Promise<UsbDeviceHandle> = () =>
    Promise.reject(new DOMException('No device selected.', 'NotFoundError'));

  private readonly listeners = new Map<string, Set<ConnectionListener>>();

  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<UsbDeviceHandle> {
    this.requestedFilters.push(options.filters);
    return this.nextRequest();
  }

  getDevices(): Promise<UsbDeviceHandle[]> {
    return Promise.resolve([...this.connected]);
  }

  addEventListener(type: 'connect' | 'disconnect', listener: ConnectionListener): void {
    const forType = this.listeners.get(type) ?? new Set();
    forType.add(listener);
    this.listeners.set(type, forType);
  }

  removeEventListener(type: 'connect' | 'disconnect', listener: ConnectionListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: 'connect' | 'disconnect', device: UsbDeviceHandle): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ device });
  }
}

export interface FakePlatform {
  readonly platform: Platform;
  readonly usb: FakeUsb;
  /** Sends a chooser request as the desktop main process would. */
  chooseDevice(request: ChooseDeviceRequest): void;
  readonly chooserResponses: { requestId: string; deviceId: string | null }[];
  setAppearance(signals: AppearanceSignals): void;
}

export function createFakePlatform(overrides: Partial<Platform> = {}): FakePlatform {
  const usb = new FakeUsb();
  const chooserListeners = new Set<(request: ChooseDeviceRequest) => void>();
  const chooserResponses: { requestId: string; deviceId: string | null }[] = [];
  const appearanceListeners = new Set<(signals: AppearanceSignals) => void>();
  let appearance: AppearanceSignals = {};

  const platform: Platform = {
    kind: 'desktop',
    os: 'macos',
    usb,
    deviceKinds: ['netmd', 'himd'],
    buildCommit: '',
    deviceChooser: {
      onChooseDevice: (callback) => {
        chooserListeners.add(callback);
        return () => chooserListeners.delete(callback);
      },
      respond: (requestId, deviceId) => chooserResponses.push({ requestId, deviceId }),
    },
    appearance: {
      get: () => appearance,
      onChange: (callback) => {
        appearanceListeners.add(callback);
        return () => appearanceListeners.delete(callback);
      },
    },
    ...overrides,
  };

  return {
    platform,
    usb,
    chooserResponses,
    chooseDevice: (request) => {
      for (const listener of chooserListeners) listener(request);
    },
    setAppearance: (signals) => {
      appearance = signals;
      for (const listener of appearanceListeners) listener(signals);
    },
  };
}
