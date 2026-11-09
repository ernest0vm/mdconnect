export type UsbFailureKind = 'no-device' | 'cancelled' | 'access-denied' | 'unknown';

/** Which WebUSB call failed: `navigator.usb.requestDevice()` or `USBDevice.open()`. */
export type UsbPhase = 'request' | 'open';

export interface ClassifyOptions {
  /** True when an in-app chooser (desktop) was dismissed; the browser cannot tell us this. */
  readonly chooserCancelled?: boolean;
}

const ACCESS_DENIED_NAMES = new Set(['SecurityError', 'NetworkError']);

/**
 * Maps a WebUSB failure to the kind the UI explains. A `NotFoundError` from `requestDevice()`
 * means no device was chosen; it is `cancelled` only when the in-app chooser says so, because
 * the browser reports an empty list and a dismissed chooser identically.
 */
export function classifyUsbError(
  error: unknown,
  phase: UsbPhase,
  options: ClassifyOptions = {},
): UsbFailureKind {
  const name = errorName(error);
  if (phase === 'request' && name === 'NotFoundError') {
    return options.chooserCancelled === true ? 'cancelled' : 'no-device';
  }
  if (phase === 'open' && name !== undefined && ACCESS_DENIED_NAMES.has(name)) {
    return 'access-denied';
  }
  return 'unknown';
}

/** Reads `name` from a thrown value without assuming it is an Error or DOMException. */
function errorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error)) return undefined;
  return typeof error.name === 'string' ? error.name : undefined;
}
