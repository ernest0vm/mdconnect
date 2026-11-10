import type { StorageLike } from '../appearance/appearance-store';
import { compareVersions, versionsSince, type ChangelogVersion } from './changelog';

export const LAST_SEEN_VERSION_KEY = 'mdconnect.lastSeenVersion';

const VERSION = /^\d+\.\d+\.\d+$/u;

/** What storage says about the last version shown: blocked, never seen (null), or a version. */
export type LastSeen =
  { readonly blocked: true } | { readonly blocked: false; readonly version: string | null };

/** Reads the last version seen. Something stored that is not a version counts as never seen. */
export function readLastSeen(storage: StorageLike | null): LastSeen {
  if (storage === null) return { blocked: true };
  try {
    const stored = storage.getItem(LAST_SEEN_VERSION_KEY);
    return { blocked: false, version: stored !== null && VERSION.test(stored) ? stored : null };
  } catch {
    return { blocked: true };
  }
}

/**
 * The versions to show as "What's new" when `current` starts: those after the last one seen, up
 * to `current`. Nothing on a first start, when storage is blocked, or for the same or an older
 * version. It does not store anything, so React may call it twice.
 */
export function whatsNew(
  lastSeen: LastSeen,
  current: string,
  versions: readonly ChangelogVersion[],
): ChangelogVersion[] {
  if (lastSeen.blocked || lastSeen.version === null) return [];
  if (compareVersions(lastSeen.version, current) >= 0) return [];
  return versionsSince(versions, lastSeen.version).filter(
    (entry) => compareVersions(entry.version, current) <= 0,
  );
}

/** Remembers `current` as seen; a blocked storage is ignored. */
export function rememberVersion(storage: StorageLike | null, current: string): void {
  try {
    storage?.setItem(LAST_SEEN_VERSION_KEY, current);
  } catch {
    // Without storage, "What's new" never opens by itself.
  }
}
