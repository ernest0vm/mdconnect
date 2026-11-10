import { describe, expect, it } from 'vitest';

import { parseChangelog } from './changelog';
import { LAST_SEEN_VERSION_KEY, readLastSeen, rememberVersion, whatsNew } from './whats-new';

const CHANGELOG = parseChangelog(`## [0.3.0] - 2027-03-01

### Added

- Three.

## [0.2.0] - 2027-02-01

### Added

- Two.

## [0.1.0] - 2026-11-10

### Added

- One.
`);

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    items,
  };
}

const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe("What's new", () => {
  it('shows the versions added since the last one seen, up to the running one (changelog: "After an update")', () => {
    const storage = memoryStorage({ [LAST_SEEN_VERSION_KEY]: '0.1.0' });
    const shown = whatsNew(readLastSeen(storage), '0.2.0', CHANGELOG);
    expect(shown.map((v) => v.version)).toEqual(['0.2.0']);
    rememberVersion(storage, '0.2.0');
    expect(whatsNew(readLastSeen(storage), '0.2.0', CHANGELOG)).toEqual([]);
  });

  it('shows nothing on a first start, and remembers the version (changelog: "First install")', () => {
    const storage = memoryStorage();
    expect(whatsNew(readLastSeen(storage), '0.3.0', CHANGELOG)).toEqual([]);
    rememberVersion(storage, '0.3.0');
    expect(storage.items.get(LAST_SEEN_VERSION_KEY)).toBe('0.3.0');
  });

  it('shows nothing when storage is blocked (changelog: "Storage blocked")', () => {
    expect(whatsNew(readLastSeen(blocked), '0.3.0', CHANGELOG)).toEqual([]);
    expect(whatsNew(readLastSeen(null), '0.3.0', CHANGELOG)).toEqual([]);
    expect(() => {
      rememberVersion(blocked, '0.3.0');
    }).not.toThrow();
  });

  it('shows nothing for the same version, an older one, or something unreadable stored', () => {
    for (const stored of ['0.3.0', '9.0.0', 'garbage']) {
      const storage = memoryStorage({ [LAST_SEEN_VERSION_KEY]: stored });
      expect(whatsNew(readLastSeen(storage), '0.3.0', CHANGELOG)).toEqual([]);
    }
  });

  it('keeps a newer version seen when an older build starts', () => {
    const storage = memoryStorage({ [LAST_SEEN_VERSION_KEY]: '0.3.0' });
    rememberVersion(storage, '0.2.0');
    expect(storage.items.get(LAST_SEEN_VERSION_KEY)).toBe('0.3.0');
    rememberVersion(storage, '0.4.0');
    expect(storage.items.get(LAST_SEEN_VERSION_KEY)).toBe('0.4.0');
  });
});
