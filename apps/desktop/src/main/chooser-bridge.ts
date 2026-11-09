import { randomUUID } from 'node:crypto';

import { chooseDevice, findDevice } from '@mdconnect/core';

import type { ChooseDeviceRequestPayload, ChooserDevicePayload } from '../shared/ipc';

/** The parts of Electron's `select-usb-device` device entries this module reads. */
export interface UsbDeviceDetails {
  readonly deviceId: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly serialNumber?: string | undefined;
}

/** Electron's `select-usb-device` callback: a device id selects it, no argument cancels. */
export type SelectionCallback = (deviceId?: string) => void;

interface PendingChoice {
  readonly requestId: string;
  readonly offered: ReadonlySet<string>;
  readonly callback: SelectionCallback;
}

/**
 * Holds at most one chooser request waiting for the renderer's answer. Answers are trusted only
 * when they match the pending request id and one of the offered device ids.
 */
export class ChooserBridge {
  private pending: PendingChoice | null = null;

  constructor(
    /** Sends the request to the renderer; returns false when no window can receive it. */
    private readonly send: (request: ChooseDeviceRequestPayload) => boolean,
    private readonly newRequestId: () => string = randomUUID,
  ) {}

  /** Sends a chooser request to the renderer, cancelling any request still pending. */
  ask(devices: readonly ChooserDevicePayload[], callback: SelectionCallback): void {
    this.cancelPending();
    const requestId = this.newRequestId();
    this.pending = { requestId, offered: new Set(devices.map((d) => d.deviceId)), callback };
    if (!this.send({ requestId, devices })) this.cancelPending();
  }

  /**
   * Applies the renderer's answer. Untrusted input: a stale request id is ignored, and a device id
   * that was not offered cancels the request instead of selecting it.
   */
  respond(requestId: unknown, deviceId: unknown): void {
    const pending = this.pending;
    if (pending === null || requestId !== pending.requestId) return;
    this.pending = null;
    const valid = typeof deviceId === 'string' && pending.offered.has(deviceId);
    pending.callback(valid ? deviceId : undefined);
  }

  /** Resolves the pending request as cancelled (new request, renderer reload, window close). */
  cancelPending(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.callback();
  }
}

/** Handles one `select-usb-device` event: pick automatically, ask the renderer, or cancel. */
export function routeDeviceSelection(
  deviceList: readonly UsbDeviceDetails[],
  callback: SelectionCallback,
  bridge: ChooserBridge,
): void {
  const choice = chooseDevice(deviceList);
  switch (choice.kind) {
    case 'none':
      callback();
      return;
    case 'auto':
      callback(choice.deviceId);
      return;
    case 'ask':
      bridge.ask(choice.devices.map(toChooserDevice), callback);
  }
}

function toChooserDevice(device: UsbDeviceDetails): ChooserDevicePayload {
  return {
    deviceId: device.deviceId,
    name: findDevice(device.vendorId, device.productId)?.name ?? 'Unknown device',
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber,
  };
}
