import type { DeviceStatus } from '@mdconnect/netmd';

/** Repeats a callback; returns a function that stops it. */
export interface PollClock {
  every(ms: number, fn: () => void): () => void;
}

/** Whether the app is visible, and a way to hear when that changes. */
export interface Visibility {
  visible(): boolean;
  onChange(listener: () => void): () => void;
}

/** About once a second, as webminidisc refreshes its player. */
export const POLL_MS = 1000;

/**
 * Reads the device status about once a second while the app is visible, and stops while it is
 * hidden. A tick is skipped while the previous read is still running, and a read that finishes
 * after `stop()` is not reported. Deciding what to show is the caller's (see `mergeStatus`).
 */
export class StatusPoller {
  private cancelTimer: (() => void) | null = null;
  private stopListening: (() => void) | null = null;
  private reading = false;
  private active = false;

  constructor(
    private readonly read: () => Promise<DeviceStatus | null>,
    private readonly report: (status: DeviceStatus | null) => void,
    private readonly clock: PollClock,
    private readonly visibility: Visibility,
  ) {}

  /** Starts polling, now if the app is visible and whenever it becomes visible. */
  start(): void {
    this.active = true;
    this.stopListening = this.visibility.onChange(() => {
      this.sync();
    });
    this.sync();
  }

  /** Stops polling and ignores any read still running. */
  stop(): void {
    this.active = false;
    this.stopListening?.();
    this.stopListening = null;
    this.pause();
  }

  /** Runs the timer only while active and visible. */
  private sync(): void {
    if (this.active && this.visibility.visible()) {
      this.cancelTimer ??= this.clock.every(POLL_MS, () => {
        this.tick();
      });
    } else {
      this.pause();
    }
  }

  /** Stops the timer, keeping the poller started. */
  private pause(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  /** Reads the status unless the previous read is still running. */
  private tick(): void {
    if (this.reading) return;
    this.reading = true;
    void this.read()
      .then((status) => {
        if (this.active) this.report(status);
      })
      .finally(() => {
        this.reading = false;
      });
  }
}

/** The browser's timer. */
export const browserClock: PollClock = {
  every: (ms, fn) => {
    const id = setInterval(fn, ms);
    return () => {
      clearInterval(id);
    };
  },
};

/** The page's visibility: hidden while the tab is in the background or the window is minimised. */
export const documentVisibility: Visibility = {
  visible: () => document.visibilityState === 'visible',
  onChange: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  },
};
