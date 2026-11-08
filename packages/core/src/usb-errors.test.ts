import { describe, expect, it } from 'vitest';

import { classifyUsbError } from './usb-errors';

const domError = (name: string) => new DOMException('message', name);

describe('classifyUsbError', () => {
  it('maps NotFoundError from requestDevice to no-device', () => {
    expect(classifyUsbError(domError('NotFoundError'), 'request')).toBe('no-device');
  });

  it('maps NotFoundError after the in-app chooser was cancelled to cancelled', () => {
    expect(classifyUsbError(domError('NotFoundError'), 'request', { chooserCancelled: true })).toBe(
      'cancelled',
    );
  });

  it.each(['SecurityError', 'NetworkError'])('maps %s from open() to access-denied', (name) => {
    expect(classifyUsbError(domError(name), 'open')).toBe('access-denied');
  });

  it('maps anything else to unknown', () => {
    expect(classifyUsbError(domError('InvalidStateError'), 'open')).toBe('unknown');
    expect(classifyUsbError(new Error('boom'), 'request')).toBe('unknown');
    expect(classifyUsbError('not an error', 'open')).toBe('unknown');
  });
});
