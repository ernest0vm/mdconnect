import type { UsbDeviceHandle } from '../../platform';

/**
 * Opens `next`, then releases the previously opened device so it is free for other apps. If `next`
 * fails to open, the previous device stays open and the error propagates. Closing is best-effort:
 * an already unplugged or busy previous device must not undo the new connection.
 */
export async function switchDevice(
  previous: UsbDeviceHandle | null,
  next: UsbDeviceHandle,
): Promise<void> {
  await next.open();
  if (previous === null || previous === next) return;
  try {
    await previous.close();
  } catch {
    // The previous device may already be gone; the new connection stands.
  }
}
