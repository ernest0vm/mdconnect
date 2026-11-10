import { describe, expect, it } from 'vitest';

import bundled from '../../../../../CHANGELOG.md?raw';
import { compareVersions, parseChangelog, versionsSince } from './changelog';

const SAMPLE = `# Changelog

All notable changes are listed here.

## [0.2.0] - 2027-01-02

### Added

- Record from the deck, see \`Record\`.
- A [Changelog](https://example.com) dialog.

### Fixed

- Upload stops cleanly.

## [0.1.0] - 2026-11-10

### Added

- Read discs.
`;

describe('parseChangelog', () => {
  it('reads versions newest first, with their sections and items', () => {
    expect(parseChangelog(SAMPLE)).toEqual([
      {
        version: '0.2.0',
        date: '2027-01-02',
        sections: [
          {
            title: 'Added',
            items: ['Record from the deck, see Record.', 'A Changelog dialog.'],
          },
          { title: 'Fixed', items: ['Upload stops cleanly.'] },
        ],
      },
      {
        version: '0.1.0',
        date: '2026-11-10',
        sections: [{ title: 'Added', items: ['Read discs.'] }],
      },
    ]);
  });

  it('joins a bullet continued on the next line', () => {
    const [version] = parseChangelog('## [1.0.0] - 2027-02-03\n\n### Added\n\n- One\n  two.\n');
    expect(version?.sections[0]?.items).toEqual(['One two.']);
  });

  it('reads the bundled CHANGELOG.md, so the dialog works offline (changelog: "Offline")', () => {
    const versions = parseChangelog(bundled);
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(version.version).toMatch(/^\d+\.\d+\.\d+$/u);
      expect(version.sections.flatMap((s) => s.items).length).toBeGreaterThan(0);
    }
  });
});

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });
});

describe('versionsSince', () => {
  it('lists the versions newer than the one seen, newest first', () => {
    const versions = parseChangelog(SAMPLE);
    expect(versionsSince(versions, '0.1.0').map((v) => v.version)).toEqual(['0.2.0']);
    expect(versionsSince(versions, '0.2.0')).toEqual([]);
  });
});
