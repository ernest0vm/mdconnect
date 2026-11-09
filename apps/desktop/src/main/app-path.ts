import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const APP_HOST = 'mdconnect';

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/**
 * Maps an `app://mdconnect/...` URL to a file inside `root`, or null when the URL points
 * elsewhere, escapes `root` (also via percent-encoding) or names a missing file.
 */
export function resolveAppPath(
  root: string,
  url: string,
  fileExists: (path: string) => boolean = isFile,
): string | null {
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  if (parsed.host !== APP_HOST) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (pathname === '/') pathname = '/index.html';

  const file = resolve(root, `.${pathname}`);
  const fromRoot = relative(root, file);
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) return null;
  return fileExists(file) ? file : null;
}
