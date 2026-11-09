import { classifyUsbError, usbFilters, type DeviceKind, type UsbFilter } from '@mdconnect/core';

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
  /** The chooser filters for the platform's device kinds; reconnects honour the same set. */
  private readonly filters: readonly UsbFilter[];

  constructor(
    private readonly usb: PlatformUsb,
    deviceKinds: readonly DeviceKind[],
    private readonly dispatch: (action: ConnectAction) => void,
  ) {
    this.filters = usbFilters({ kinds: deviceKinds });
  }

  /** The first granted device the platform offers, for reconnecting on launch. */
  firstOffered(handles: readonly UsbDeviceHandle[]): UsbDeviceHandle | undefined {
    return handles.find((handle) => this.offers(handle));
  }

  /** The "Connect device" button. Ignored while another open is in progress. */
  async request(chooserWasCancelled: () => boolean): Promise<void> {
    if (!this.begin()) return;
    try {
      let handle: UsbDeviceHandle;
      try {
        handle = await this.usb.requestDevice({ filters: [...this.filters] });
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
    if (this.openHandle !== null || !this.offers(handle)) return;
    if (!this.begin()) return;
    try {
      await this.open(handle);
    } finally {
      this.busy = false;
    }
  }

  /**
   * Forwards a USB `disconnect`. An unplug of the device being switched to is remembered and
   * applied when the switch settles; only the open device itself resets the screen.
   */
  handleDisconnect(handle: UsbDeviceHandle): void {
    if (handle === this.switchingTo) {
      this.unplugged.add(handle);
      return;
    }
    if (handle === this.openHandle) {
      this.openHandle = null;
      this.dispatch({ type: 'device-disconnected', device: describeDevice(handle) ?? null });
    }
  }

  /** Whether the chooser would have offered this device (a kind this platform supports). */
  private offers({ vendorId, productId }: UsbDeviceHandle): boolean {
    return this.filters.some((f) => f.vendorId === vendorId && f.productId === productId);
  }

  /** Claims the busy guard synchronously; false when another open already holds it. */
  private begin(): boolean {
    if (this.busy) return false;
    this.busy = true;
    this.dispatch({ type: 'request-started' });
    return true;
  }

  /**
   * Switches to `handle` and reports the outcome: connected, failed (previous device stays open),
   * or disconnected when the new device was unplugged before the switch finished.
   */
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
      this.dispatch({ type: 'device-disconnected', device });
      return;
    }
    this.openHandle = handle;
    this.dispatch({ type: 'connected', device });
  }
}
