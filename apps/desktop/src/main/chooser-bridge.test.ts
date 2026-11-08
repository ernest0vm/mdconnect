import { describe, expect, it } from 'vitest';

import { ChooserBridge, routeDeviceSelection, type UsbDeviceDetails } from './chooser-bridge';

const mzN510: UsbDeviceDetails = { deviceId: 'a', vendorId: 0x054c, productId: 0x00c9 };
const mzRh1: UsbDeviceDetails = {
  deviceId: 'b',
  vendorId: 0x054c,
  productId: 0x0286,
  serialNumber: 'S1',
};
const keyboard: UsbDeviceDetails = { deviceId: 'k', vendorId: 0x046d, productId: 0xc52b };

function setup() {
  const sent: { requestId: string; devices: readonly { deviceId: string; name: string }[] }[] = [];
  let ids = 0;
  const bridge = new ChooserBridge(
    (request) => {
      sent.push(request);
      return true;
    },
    () => `req-${String(++ids)}`,
  );
  const results: (string | undefined)[] = [];
  const callback = (deviceId?: string) => results.push(deviceId);
  return { bridge, sent, results, callback };
}

describe('routeDeviceSelection (usb-device-access: "Desktop device selection")', () => {
  it('cancels when no supported device is listed', () => {
    const { bridge, results, callback } = setup();
    routeDeviceSelection([keyboard], callback, bridge);
    expect(results).toEqual([undefined]);
  });

  it('selects the only supported device without asking', () => {
    const { bridge, sent, results, callback } = setup();
    routeDeviceSelection([keyboard, mzN510], callback, bridge);
    expect(results).toEqual(['a']);
    expect(sent).toEqual([]);
  });

  it('asks the renderer when several supported devices are listed, with names', () => {
    const { bridge, sent, results, callback } = setup();
    routeDeviceSelection([mzN510, keyboard, mzRh1], callback, bridge);
    expect(results).toEqual([]);
    expect(sent).toEqual([
      {
        requestId: 'req-1',
        devices: [
          {
            deviceId: 'a',
            name: 'Sony MZ-N510/N610',
            vendorId: 0x054c,
            productId: 0x00c9,
            serialNumber: undefined,
          },
          {
            deviceId: 'b',
            name: 'Sony MZ-RH1',
            vendorId: 0x054c,
            productId: 0x0286,
            serialNumber: 'S1',
          },
        ],
      },
    ]);
  });
});

describe('ChooserBridge', () => {
  const ask = () => {
    const s = setup();
    routeDeviceSelection([mzN510, mzRh1], s.callback, s.bridge);
    return s;
  };

  it('returns the chosen device for the pending request', () => {
    const { bridge, results } = ask();
    bridge.respond('req-1', 'b');
    expect(results).toEqual(['b']);
  });

  it('cancels when the renderer answers null', () => {
    const { bridge, results } = ask();
    bridge.respond('req-1', null);
    expect(results).toEqual([undefined]);
  });

  it('ignores a stale request id', () => {
    const { bridge, results } = ask();
    bridge.respond('req-0', 'b');
    expect(results).toEqual([]);
  });

  it('cancels instead of trusting a device id that was not offered', () => {
    const { bridge, results } = ask();
    bridge.respond('req-1', 'k');
    expect(results).toEqual([undefined]);
    bridge.respond('req-1', 'b');
    expect(results).toEqual([undefined]);
  });

  it('cancels the pending request when a new one supersedes it', () => {
    const { bridge, results, callback } = ask();
    routeDeviceSelection([mzN510, mzRh1], callback, bridge);
    expect(results).toEqual([undefined]);
    bridge.respond('req-2', 'a');
    expect(results).toEqual([undefined, 'a']);
  });

  it('cancels on reload or window close', () => {
    const { bridge, results } = ask();
    bridge.cancelPending();
    expect(results).toEqual([undefined]);
    bridge.cancelPending();
    expect(results).toEqual([undefined]);
  });

  it('cancels at once when no window can receive the request', () => {
    const results: (string | undefined)[] = [];
    const bridge = new ChooserBridge(
      () => false,
      () => 'req-1',
    );
    routeDeviceSelection([mzN510, mzRh1], (id) => results.push(id), bridge);
    expect(results).toEqual([undefined]);
  });
});
