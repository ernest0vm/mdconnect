/** Most file systems refuse names longer than 255 bytes; this stays under it for any script. */
const MAX_NAME_LENGTH = 255;
const MAX_ATTEMPTS = 1000;

/**
 * Whether a name can be used as a file name inside a folder: not empty, not `.` or `..`, no path
 * separator and no control character, so it can never point outside the folder.
 */
export function isSafeFileName(name: string): boolean {
  if (name === '' || name === '.' || name === '..' || name.length > MAX_NAME_LENGTH) return false;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused.
  return !/[/\\\u0000-\u001f\u007f]/u.test(name);
}

/** `name`, or `name (2)`, `name (3)`… with the number before the extension, whichever is free. */
export function uniqueFileName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  const dot = name.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let number = 2; number <= MAX_ATTEMPTS; number += 1) {
    const candidate = `${stem} (${String(number)})${extension}`;
    if (!taken(candidate)) return candidate;
  }
  throw new Error(`No free name like "${name}" after ${String(MAX_ATTEMPTS)} attempts`);
}
