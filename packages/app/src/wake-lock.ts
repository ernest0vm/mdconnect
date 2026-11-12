/** Keeps the screen on, where the platform allows it; resolves with the function that releases it. */
export async function holdWakeLock(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock.request('screen');
    return () => {
      void lock.release();
    };
  } catch {
    return () => undefined;
  }
}
