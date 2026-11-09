import { classifyUsbError, usbFilters } from '@mdconnect/core';

import type { PlatformUsb, UsbDeviceHandle } from '../../platform';
import { describeDevice, type ConnectAction } from './connect-state';
import { switchDevice } from './switch-device';

/**
 * Owns the device connection lifecycle outside React. Manual requests and automatic reconnects
 * share one synchronous busy guard, so two opens never overlap, and the controller tracks both the
 * open device and the one being switched to, so an unplug during a switch is never lost.
 */
export class ConnectionController {
  private busy = false;
  private openHandle: UsbDeviceHandle | null = null;
  private switchingTo: UsbDeviceHandle | null = null;
  /** Devices unplugged while they were being switched to. */
  private readonly unplugged = new WeakSet<UsbDeviceHandle>();

  constructor(
    private readonly usb: PlatformUsb,
    private readonly dispatch: (action: ConnectAction) => void,
  ) {}

  /** The "Connect device" button. Ignored while another open is in progress. */
  async request(chooserWasCancelled: () => boolean): Promise<void> {
    if (!this.begin()) return;
    try {
      let handle: UsbDeviceHandle;
      try {
        handle = await this.usb.requestDevice({ filters: usbFilters() });
      } catch (error) {
        this.dispatch({
          type: 'failed',
          failure: classifyUsbError(error, 'request', { chooserCancelled: chooserWasCancelled() }),
        });
        return;
      }
      await this.open(handle);
    } finally {
      this.busy = false;
    }
  }

  /** Reconnect without prompting (launch and plug-in): only when nothing is open or opening. */
  async autoConnect(handle: UsbDeviceHandle): Promise<void> {
    if (this.openHandle !== null || describeDevice(handle) === undefined) return;
    if (!this.begin()) return;
    try {
      await this.open(handle);
    } finally {
      this.busy = false;
    }
  }

  handleDisconnect(handle: UsbDeviceHandle): void {
    if (handle === this.switchingTo) {
      this.unplugged.add(handle);
      return;
    }
    if (handle === this.openHandle) {
      this.openHandle = null;
      this.dispatch({ type: 'device-disconnected' });
    }
  }

  private begin(): boolean {
    if (this.busy) return false;
    this.busy = true;
    this.dispatch({ type: 'request-started' });
    return true;
  }

  private async open(handle: UsbDeviceHandle): Promise<void> {
    const device = describeDevice(handle);
    if (device === undefined) {
      this.dispatch({ type: 'failed', failure: 'no-device' });
      return;
    }
    this.switchingTo = handle;
    this.unplugged.delete(handle);
    try {
      await switchDevice(this.openHandle, handle);
    } catch (error) {
      this.dispatch({ type: 'failed', failure: classifyUsbError(error, 'open') });
      return;
    } finally {
      this.switchingTo = null;
    }
    if (this.unplugged.has(handle)) {
      // switchDevice already closed the previous device; the new one is gone too.
      this.openHandle = null;
      this.dispatch({ type: 'device-disconnected' });
      return;
    }
    this.openHandle = handle;
    this.dispatch({ type: 'connected', device });
  }
}
