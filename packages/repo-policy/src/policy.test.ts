import { describe, expect, it } from 'vitest';

import {
  allManifests,
  parseAgeGateMinutes,
  readRootFile,
  readYarnrc,
  workspaceManifests,
} from './repo';

const SEVEN_DAYS_IN_MINUTES = 7 * 24 * 60;

/** Packages allowed to run install scripts. Each entry needs a reason. */
const INSTALL_SCRIPT_ALLOWLIST: Record<string, string> = {
  electron: 'postinstall downloads the checksum-verified Electron binary',
};

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
  it('pre-commit runs lint-staged and the affected checks', () => {
    const hook = readRootFile('.husky/pre-commit');
    expect(hook).toMatch(/lint-staged/);
    expect(hook).toMatch(/--affected/);
  });
});
