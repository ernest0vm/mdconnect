/** One group of changes in a version, such as "Added" or "Fixed". */
export interface ChangelogSection {
  readonly title: string;
  readonly items: readonly string[];
}

export interface ChangelogVersion {
  readonly version: string;
  readonly date: string;
  readonly sections: readonly ChangelogSection[];
}

const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\](?: - (\S+))?/u;
const SECTION_HEADING = /^### (.+)$/u;
const BULLET = /^- (.*)$/u;
const CONTINUATION = /^ {2,}(\S.*)$/u;

/** Markdown links become their text and inline code loses its backticks. */
function plainText(markdown: string): string {
  return markdown.replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1').replace(/`([^`]*)`/gu, '$1');
}

interface Draft {
  version: string;
  date: string;
  sections: { title: string; items: string[] }[];
}

/**
 * Reads the subset of Keep a Changelog Markdown that CHANGELOG.md uses: `## [x.y.z] - date`
 * headings, `### Section` headings and `- ` bullets, which may continue on indented lines.
 * Anything else, such as the introduction, is skipped. Versions keep the file's order, newest first.
 */
export function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: Draft[] = [];
  for (const line of markdown.split(/\r?\n/u)) {
    const version = VERSION_HEADING.exec(line);
    if (version) {
      versions.push({ version: version[1] ?? '', date: version[2] ?? '', sections: [] });
      continue;
    }
    const current = versions.at(-1);
    if (current === undefined) continue;
    const section = SECTION_HEADING.exec(line);
    if (section) {
      current.sections.push({ title: (section[1] ?? '').trim(), items: [] });
      continue;
    }
    const items = current.sections.at(-1)?.items;
    if (items === undefined) continue;
    const bullet = BULLET.exec(line);
    const continued = CONTINUATION.exec(line);
    if (bullet) {
      items.push(bullet[1] ?? '');
    } else if (continued) {
      const last = items.pop();
      if (last !== undefined) items.push(`${last} ${continued[1] ?? ''}`);
    }
  }
  return versions.map((version) => ({
    ...version,
    sections: version.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => plainText(item.trim())),
    })),
  }));
}

/** Compares two dotted versions part by part as numbers; missing parts count as zero. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The versions newer than `seen`, newest first. */
export const versionsSince = (
  versions: readonly ChangelogVersion[],
  seen: string,
): ChangelogVersion[] => versions.filter((entry) => compareVersions(entry.version, seen) > 0);
