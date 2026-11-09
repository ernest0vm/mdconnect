import { describe, expect, it } from 'vitest';

import type { UsbDeviceHandle } from '../../platform';
import { switchDevice } from './switch-device';
import { netMdStub } from '../../testing/netmd-stub';

function handle(name: string, log: string[], closeFails = false): UsbDeviceHandle {
  return {
    ...netMdStub(),
    vendorId: 0x054c,
    productId: 0x00c9,
    open: () => {
      log.push(`open ${name}`);
      return Promise.resolve();
    },
    close: () => {
      log.push(`close ${name}`);
      return closeFails ? Promise.reject(new Error('busy')) : Promise.resolve();
    },
  };
}

describe('switchDevice', () => {
  it('opens the new device, then closes the previous one', async () => {
    const log: string[] = [];
    await switchDevice(handle('A', log), handle('B', log));
    expect(log).toEqual(['open B', 'close A']);
  });

  it('only opens when nothing was open', async () => {
    const log: string[] = [];
    await switchDevice(null, handle('B', log));
    expect(log).toEqual(['open B']);
  });

  it('does not close a device that is reopened', async () => {
    const log: string[] = [];
    const same = handle('A', log);
    await switchDevice(same, same);
    expect(log).toEqual(['open A']);
  });

  it('keeps the new device when closing the previous one fails', async () => {
    const log: string[] = [];
    await expect(switchDevice(handle('A', log, true), handle('B', log))).resolves.toBeUndefined();
  });

  it('leaves the previous device open when the new one fails to open', async () => {
    const log: string[] = [];
    const failing: UsbDeviceHandle = {
      ...handle('B', log),
      open: () => Promise.reject(new DOMException('denied', 'SecurityError')),
    };
    await expect(switchDevice(handle('A', log), failing)).rejects.toThrow('denied');
    expect(log).toEqual([]);
  });
});
