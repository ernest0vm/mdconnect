import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  allManifests,
  parseAgeGateMinutes,
  parseYarnrc,
  readRootFile,
  readYarnrc,
  repoRoot,
  workspaceManifests,
} from './repo';

const SEVEN_DAYS_IN_MINUTES = 7 * 24 * 60;

/**
 * Packages allowed to run install scripts. Each entry needs a reason. Empty on purpose: Electron 44+
 * downloads its binary on first run (checksum-verified) instead of in a postinstall script.
 */
const INSTALL_SCRIPT_ALLOWLIST: Record<string, string> = {};

/** UI stacks replaced by shadcn/ui + Tailwind + GlassyUI. */
const BANNED_DEPENDENCIES = [
  /^@mui\//,
  /^@material-ui\//,
  /^@emotion\//,
  /^styled-components$/,
  /^tss-react$/,
  /^react95$/,
];

const CHECK_SCRIPTS = ['lint', 'format:check', 'typecheck', 'test'] as const;

describe('parseAgeGateMinutes', () => {
  it.each([
    ['7d', 10080],
    ['"7d"', 10080],
    ['12h', 720],
    ['90m', 90],
    ['10080', 10080],
    ['2w', 20160],
  ])('parses %s as %i minutes', (raw, minutes) => {
    expect(parseAgeGateMinutes(raw)).toBe(minutes);
  });

  it('rejects values it cannot parse', () => {
    expect(() => parseAgeGateMinutes('soon')).toThrow(/npmMinimalAgeGate/);
  });
});

describe('parseYarnrc', () => {
  it('keeps a hash inside a quoted value and drops the trailing comment', () => {
    const rc = parseYarnrc('npmRegistryServer: "https://host/x #y"  # mirror\n');
    expect(rc.get('npmRegistryServer')).toBe('https://host/x #y');
  });

  it('unquotes single-quoted values', () => {
    expect(parseYarnrc("nodeLinker: 'node-modules' # linker").get('nodeLinker')).toBe(
      'node-modules',
    );
  });

  it('drops a trailing comment from a plain value', () => {
    expect(parseYarnrc('enableScripts: false   # off').get('enableScripts')).toBe('false');
  });

  it('records nested keys as present with an empty value', () => {
    const rc = parseYarnrc('npmPreapprovedPackages:\n  - left-pad\n');
    expect(rc.has('npmPreapprovedPackages')).toBe(true);
    expect(rc.get('npmPreapprovedPackages')).toBe('');
  });

  it('ignores comment lines and indented lines', () => {
    const rc = parseYarnrc('# nodeLinker: pnp\n  nested: value\n');
    expect([...rc.keys()]).toEqual([]);
  });
});

describe('supply chain (.yarnrc.yml)', () => {
  const yarnrc = readYarnrc();

  it('refuses package versions younger than 7 days', () => {
    const raw = yarnrc.get('npmMinimalAgeGate');
    expect(raw, 'npmMinimalAgeGate must be set').toBeDefined();
    expect(parseAgeGateMinutes(raw ?? '')).toBeGreaterThanOrEqual(SEVEN_DAYS_IN_MINUTES);
  });

  it('does not pre-approve packages around the age gate', () => {
    expect(yarnrc.has('npmPreapprovedPackages')).toBe(false);
  });

  it('disables dependency install scripts by default', () => {
    expect(yarnrc.get('enableScripts')).toBe('false');
  });

  it('uses the node-modules linker', () => {
    expect(yarnrc.get('nodeLinker')).toBe('node-modules');
  });
});

describe('package manifests', () => {
  const manifests = allManifests();

  it('pins Yarn 4 as the package manager', () => {
    const root = manifests.find((m) => m.isRoot);
    expect(root?.json.packageManager).toMatch(/^yarn@4\./);
  });

  it('runs the committed Yarn release that packageManager names, without Corepack', () => {
    const root = manifests.find((m) => m.isRoot);
    const version = root?.json.packageManager?.replace(/^yarn@/, '');
    const yarnPath = readYarnrc().get('yarnPath');
    expect(yarnPath).toBe(`.yarn/releases/yarn-${String(version)}.cjs`);
    expect(existsSync(join(repoRoot, String(yarnPath)))).toBe(true);
  });

  it.each(manifests.map((m) => [m.name, m] as const))(
    '%s only lets allowlisted packages run install scripts',
    (_name, manifest) => {
      const built = Object.entries(manifest.json.dependenciesMeta ?? {})
        .filter(([, meta]) => meta.built === true)
        .map(([pkg]) => pkg);
      expect(built.filter((pkg) => !(pkg in INSTALL_SCRIPT_ALLOWLIST))).toEqual([]);
    },
  );

  it.each(manifests.map((m) => [m.name, m] as const))(
    '%s does not depend on banned UI libraries',
    (_name, manifest) => {
      const deps = Object.keys({
        ...manifest.json.dependencies,
        ...manifest.json.devDependencies,
        ...manifest.json.peerDependencies,
        ...manifest.json.optionalDependencies,
      });
      expect(deps.filter((dep) => BANNED_DEPENDENCIES.some((re) => re.test(dep)))).toEqual([]);
    },
  );

  it.each(manifests.map((m) => [m.name, m] as const))('%s is GPL-2.0-only', (_name, manifest) => {
    expect(manifest.json.license).toBe('GPL-2.0-only');
  });
});

describe('workspace conventions', () => {
  const codeWorkspaces = workspaceManifests().filter((m) => m.hasTsconfig);

  it.each(workspaceManifests().map((m) => [m.name, m] as const))(
    '%s declares no dependenciesMeta (Yarn only reads it from the root manifest)',
    (_name, manifest) => {
      expect(manifest.json.dependenciesMeta).toBeUndefined();
    },
  );

  it('finds at least this package', () => {
    expect(codeWorkspaces.map((m) => m.name)).toContain('@mdconnect/repo-policy');
  });

  it.each(codeWorkspaces.map((m) => [m.name, m] as const))(
    '%s defines every check script turbo runs',
    (_name, manifest) => {
      const missing = CHECK_SCRIPTS.filter((s) => !manifest.json.scripts?.[s]);
      expect(missing).toEqual([]);
    },
  );

  it.each(codeWorkspaces.map((m) => [m.name, m] as const))(
    '%s depends on the shared tsconfig so changes to it mark the package affected',
    (_name, manifest) => {
      expect(manifest.json.devDependencies?.['@mdconnect/tsconfig']).toMatch(/^workspace:/);
    },
  );
});

describe('git hooks', () => {
  const lintStaged = readRootFile('lint-staged.config.mjs');

  it('pre-commit runs lint-staged serially on the staged snapshot only', () => {
    expect(readRootFile('.husky/pre-commit')).toMatch(/lint-staged --concurrent false --hide-all/);
  });

  it('runs affected typecheck and tests inside lint-staged, where unstaged changes are hidden', () => {
    expect(lintStaged).toMatch(/turbo run root:typecheck typecheck test --affected/);
  });

  it('does not fail commits that stage files ESLint ignores', () => {
    expect(lintStaged).toMatch(/eslint --fix --no-warn-ignored --max-warnings 0/);
  });
});
