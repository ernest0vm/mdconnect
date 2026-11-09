import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { resolveAppPath } from './app-path';

describe('resolveAppPath', () => {
  let root = '';

  beforeAll(() => {
    const base = mkdtempSync(join(tmpdir(), 'mdconnect-app-path-'));
    root = join(base, 'renderer');
    mkdirSync(join(root, 'assets'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '<!doctype html>');
    writeFileSync(join(root, 'assets', 'app.js'), '');
    writeFileSync(join(base, 'secret.txt'), 'outside the renderer');
  });

  it('maps / to index.html', () => {
    expect(resolveAppPath(root, 'app://mdconnect/')).toBe(join(root, 'index.html'));
  });

  it('serves files inside the renderer directory', () => {
    expect(resolveAppPath(root, 'app://mdconnect/assets/app.js')).toBe(
      join(root, 'assets', 'app.js'),
    );
  });

  it('rejects ../ traversal', () => {
    expect(resolveAppPath(root, 'app://mdconnect/../secret.txt')).toBeNull();
  });

  it('rejects encoded traversal', () => {
    expect(resolveAppPath(root, 'app://mdconnect/%2e%2e%2fsecret.txt')).toBeNull();
    expect(resolveAppPath(root, 'app://mdconnect/assets/%2E%2E%2F%2E%2E%2Fsecret.txt')).toBeNull();
  });

  it('keeps decoded absolute paths inside the root even when the target exists', () => {
    const everythingExists = () => true;
    const outside = join(root, '..', 'secret.txt');
    const resolved = resolveAppPath(
      root,
      `app://mdconnect/${encodeURIComponent(outside)}`,
      everythingExists,
    );
    expect(resolved?.startsWith(root)).toBe(true);
    expect(
      resolveAppPath(root, 'app://mdconnect/%2e%2e%2fsecret.txt', everythingExists),
    ).toBeNull();
  });

  it('rejects missing files and other hosts', () => {
    expect(resolveAppPath(root, 'app://mdconnect/missing.js')).toBeNull();
    expect(resolveAppPath(root, 'app://other/index.html')).toBeNull();
  });
});
