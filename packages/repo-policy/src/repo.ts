import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

type DependencyMap = Record<string, string>;

export interface PackageJson {
  name?: string;
  license?: string;
  packageManager?: string;
  workspaces?: string[];
  scripts?: Record<string, string>;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  dependenciesMeta?: Record<string, { built?: boolean; optional?: boolean; unplugged?: boolean }>;
}

export interface Manifest {
  name: string;
  dir: string;
  isRoot: boolean;
  hasTsconfig: boolean;
  json: PackageJson;
}

export function readRootFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readManifest(dir: string, isRoot: boolean): Manifest {
  const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson;
  return {
    name: json.name ?? dir,
    dir,
    isRoot,
    hasTsconfig: existsSync(join(dir, 'tsconfig.json')),
    json,
  };
}

/** Expands the root `workspaces` globs. Only the `<dir>/*` form is supported. */
export function workspaceManifests(): Manifest[] {
  const root = readManifest(repoRoot, true);
  return (root.json.workspaces ?? []).flatMap((pattern) => {
    if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) {
      throw new Error(`Unsupported workspace pattern "${pattern}"; extend repo.ts to handle it.`);
    }
    const parent = join(repoRoot, pattern.slice(0, -2));
    if (!existsSync(parent)) return [];
    return readdirSync(parent, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && existsSync(join(parent, entry.name, 'package.json')),
      )
      .map((entry) => readManifest(join(parent, entry.name), false));
  });
}

export function allManifests(): Manifest[] {
  return [readManifest(repoRoot, true), ...workspaceManifests()];
}

export function readYarnrc(): Map<string, string> {
  return parseYarnrc(readRootFile('.yarnrc.yml'));
}

/**
 * Parses top-level scalar keys of a `.yarnrc.yml`. Nested values (lists, maps) are recorded
 * as present with an empty string, which is enough for "is this key set" checks.
 */
export function parseYarnrc(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (!match) continue;
    const [, key = '', rawValue = ''] = match;
    entries.set(key, parseScalar(rawValue));
  }
  return entries;
}

/** A quoted scalar ends at its closing quote; anything after it, such as a comment, is dropped. */
function parseScalar(rawValue: string): string {
  const value = rawValue.trim();
  const quoted = /^(['"])(.*?)\1/.exec(value);
  if (quoted) return quoted[2] ?? '';
  return value.replace(/\s*#.*$/, '');
}

const UNIT_MINUTES = { m: 1, h: 60, d: 60 * 24, w: 60 * 24 * 7 } as const;

/** Parses Yarn's `npmMinimalAgeGate` (minutes, or a duration such as `7d`) into minutes. */
export function parseAgeGateMinutes(raw: string): number {
  const value = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  const match = /^(\d+)([mhdw])?$/.exec(value);
  if (!match) throw new Error(`Cannot parse npmMinimalAgeGate value "${raw}"`);
  const [, amount = '0', unit] = match;
  return Number(amount) * (unit ? UNIT_MINUTES[unit as keyof typeof UNIT_MINUTES] : 1);
}
