import type { DeviceKind } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

import type { UsbDeviceHandle } from '../../platform';
import { FakeUsb } from '../../testing/fake-platform';
import type { ConnectAction } from './connect-state';
import { ConnectionController } from './connection-controller';
import { netMdStub } from '../../testing/netmd-stub';

/** A device whose open() and close() resolve only when the test says so. */
function controllableDevice(productId: number) {
  let resolveOpen: () => void = () => undefined;
  let rejectOpen: (error: unknown) => void = () => undefined;
  let resolveClose: () => void = () => undefined;
  const calls: string[] = [];
  const handle: UsbDeviceHandle = {
    ...netMdStub(),
    vendorId: 0x054c,
    productId,
    open: () => {
      calls.push('open');
      return new Promise<void>((resolve, reject) => {
        resolveOpen = resolve;
        rejectOpen = reject;
      });
    },
    close: () => {
      calls.push('close');
      return new Promise<void>((resolve) => {
        resolveClose = resolve;
      });
    },
  };
  return {
    handle,
    calls,
    finishOpen: () => {
      resolveOpen();
    },
    failOpen: (error: unknown) => {
      rejectOpen(error);
    },
    finishClose: () => {
      resolveClose();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const MZ_N510 = 0x00c9;
const MZ_RH1 = 0x0286;

function setup(kinds: readonly DeviceKind[] = ['netmd', 'himd']) {
  const usb = new FakeUsb();
  const actions: ConnectAction['type'][] = [];
  const log: ConnectAction[] = [];
  const controller = new ConnectionController(usb, kinds, (action) => {
    actions.push(action.type);
    log.push(action);
  });
  return { usb, actions, log, controller };
}

const HIMD_MODE_RH1 = { vendorId: 0x054c, productId: 0x0287 };

describe('ConnectionController', () => {
  it('connects the device the user picks', async () => {
    const { usb, actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    usb.nextRequest = () => Promise.resolve(a.handle);
    const done = controller.request(() => false);
    await flush();
    a.finishOpen();
    await done;
    expect(actions).toEqual(['request-started', 'connected']);
  });

  it('classifies a cancelled in-app chooser', async () => {
    const { actions, controller } = setup();
    await controller.request(() => true);
    expect(actions).toEqual(['request-started', 'failed']);
  });

  it('ignores a plug-in event while a manual request is running', async () => {
    const { usb, actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    usb.nextRequest = () => Promise.resolve(a.handle);
    const manual = controller.request(() => false);
    await controller.autoConnect(b.handle);
    await flush();
    a.finishOpen();
    await manual;
    expect(b.calls).toEqual([]);
    expect(actions).toEqual(['request-started', 'connected']);
  });

  it('ignores a manual request while an automatic open is running', async () => {
    const { usb, actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const auto = controller.autoConnect(a.handle);
    await controller.request(() => false);
    a.finishOpen();
    await auto;
    expect(usb.requestedFilters).toEqual([]);
    expect(actions).toEqual(['request-started', 'connected']);
  });

  it('does not replace a connected device on a plug-in event', async () => {
    const { actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    const first = controller.autoConnect(a.handle);
    a.finishOpen();
    await first;
    await controller.autoConnect(b.handle);
    expect(b.calls).toEqual([]);
    expect(actions).toEqual(['request-started', 'connected']);
  });

  it('ignores unsupported devices on plug-in', async () => {
    const { actions, controller } = setup();
    const keyboard: UsbDeviceHandle = {
      ...netMdStub(),
      vendorId: 0x046d,
      productId: 0xc52b,
      open: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    await controller.autoConnect(keyboard);
    expect(actions).toEqual([]);
  });

  it('switches devices: opens the new one, closes the previous one', async () => {
    const { usb, actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    const first = controller.autoConnect(a.handle);
    a.finishOpen();
    await first;
    usb.nextRequest = () => Promise.resolve(b.handle);
    const second = controller.request(() => false);
    await flush();
    b.finishOpen();
    await flush();
    a.finishClose();
    await second;
    expect(a.calls).toEqual(['open', 'close']);
    expect(actions).toEqual(['request-started', 'connected', 'request-started', 'connected']);
  });

  it('keeps the previous device when the new one fails to open', async () => {
    const { usb, actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    const first = controller.autoConnect(a.handle);
    a.finishOpen();
    await first;
    usb.nextRequest = () => Promise.resolve(b.handle);
    const second = controller.request(() => false);
    await flush();
    b.failOpen(new DOMException('denied', 'SecurityError'));
    await second;
    expect(a.calls).toEqual(['open']);
    controller.handleDisconnect(a.handle);
    expect(actions).toEqual([
      'request-started',
      'connected',
      'request-started',
      'failed',
      'device-disconnected',
    ]);
  });

  it('does not report a device that was unplugged while the switch finished', async () => {
    const { usb, actions, log, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    const first = controller.autoConnect(a.handle);
    a.finishOpen();
    await first;
    usb.nextRequest = () => Promise.resolve(b.handle);
    const second = controller.request(() => false);
    await flush();
    b.finishOpen();
    await flush();
    controller.handleDisconnect(b.handle);
    a.finishClose();
    await second;
    expect(actions.at(-1)).toBe('device-disconnected');
    expect(actions).not.toContain('failed');
    expect(actions.filter((type) => type === 'connected')).toHaveLength(1);
    // The device that left is the one being switched to, not the previous one.
    expect(log.at(-1)).toMatchObject({
      type: 'device-disconnected',
      device: { productId: MZ_RH1 },
    });
  });

  it('reports an unplug, not a failure, when a first open rejects because the device left', async () => {
    const { log, actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const opening = controller.autoConnect(a.handle);
    controller.handleDisconnect(a.handle);
    a.failOpen(new DOMException('The device was disconnected.', 'NotFoundError'));
    await opening;
    expect(actions).not.toContain('failed');
    expect(log.at(-1)).toMatchObject({
      type: 'device-disconnected',
      device: { productId: MZ_N510 },
    });
  });

  it('keeps reporting a failed switch while the previous device stays open', async () => {
    const { usb, log, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    const first = controller.autoConnect(a.handle);
    a.finishOpen();
    await first;
    usb.nextRequest = () => Promise.resolve(b.handle);
    const second = controller.request(() => false);
    await flush();
    controller.handleDisconnect(b.handle);
    b.failOpen(new DOMException('The device was disconnected.', 'NotFoundError'));
    await second;
    expect(log.at(-1)?.type).toBe('failed');
  });

  it('exposes the open device once connected, and none after it is unplugged', async () => {
    const { controller } = setup();
    const a = controllableDevice(MZ_N510);
    expect(controller.openDevice()).toBeNull();
    const opening = controller.autoConnect(a.handle);
    a.finishOpen();
    await opening;
    expect(controller.openDevice()).toBe(a.handle);
    controller.handleDisconnect(a.handle);
    expect(controller.openDevice()).toBeNull();
  });

  it('reports which open device was unplugged', async () => {
    const { log, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const opening = controller.autoConnect(a.handle);
    a.finishOpen();
    await opening;
    controller.handleDisconnect(a.handle);
    expect(log.at(-1)).toMatchObject({
      type: 'device-disconnected',
      device: { productId: MZ_N510 },
    });
  });

  it('ignores the unplugging of a device it never opened', async () => {
    const { actions, controller } = setup();
    const a = controllableDevice(MZ_N510);
    const b = controllableDevice(MZ_RH1);
    const first = controller.autoConnect(a.handle);
    a.finishOpen();
    await first;
    controller.handleDisconnect(b.handle);
    expect(actions).toEqual(['request-started', 'connected']);
  });

  it('requests every supported device kind on desktop', async () => {
    const { usb, controller } = setup();
    await controller.request(() => false);
    expect(usb.requestedFilters[0]).toContainEqual(HIMD_MODE_RH1);
  });

  it('requests NetMD devices only on the web', async () => {
    const { usb, controller } = setup(['netmd']);
    await controller.request(() => false);
    expect(usb.requestedFilters[0]).not.toContainEqual(HIMD_MODE_RH1);
    expect(usb.requestedFilters[0]).toHaveLength(47);
  });

  describe('automatic reconnect on the web (usb-device-access: "Web reconnect for granted devices")', () => {
    const handleFor = (productId: number): UsbDeviceHandle => ({
      ...netMdStub(),
      vendorId: 0x054c,
      productId,
      open: () => Promise.resolve(),
      close: () => Promise.resolve(),
    });

    it('ignores a plugged-in device of a kind the platform does not offer', async () => {
      const { actions, controller } = setup(['netmd']);
      await controller.autoConnect(handleFor(HIMD_MODE_RH1.productId));
      expect(actions).toEqual([]);
    });

    it('picks the first granted device the platform offers, skipping other kinds', () => {
      const { controller } = setup(['netmd']);
      const himd = handleFor(HIMD_MODE_RH1.productId);
      const netmd = handleFor(MZ_N510);
      expect(controller.firstOffered([himd, netmd])).toBe(netmd);
      expect(controller.firstOffered([himd])).toBeUndefined();
    });

    it('still reconnects Hi-MD mode devices on desktop', async () => {
      const { actions, controller } = setup();
      await controller.autoConnect(handleFor(HIMD_MODE_RH1.productId));
      expect(actions).toEqual(['request-started', 'connected']);
    });
  });
});
