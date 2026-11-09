import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { usbFilters } from '@mdconnect/core';
import { describe, expect, it } from 'vitest';

const RULES_FILE = join(import.meta.dirname, '../../resources/linux/60-mdconnect.rules');
const RULE =
  /^SUBSYSTEM=="usb", ATTR\{idVendor\}=="([0-9a-f]{4})", ATTR\{idProduct\}=="([0-9a-f]{4})", TAG\+="uaccess"$/;

const hex = (value: number) => value.toString(16).padStart(4, '0');

describe('Linux udev rules', () => {
  const lines = readFileSync(RULES_FILE, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));

  it('contains only well-formed uaccess rules', () => {
    expect(lines.filter((line) => !RULE.test(line))).toEqual([]);
  });

  it('matches the supported device table exactly', () => {
    const rules = lines.map((line) => {
      const [, vendor, product] = RULE.exec(line) ?? [];
      return `${vendor ?? ''}:${product ?? ''}`;
    });
    const table = usbFilters().map((f) => `${hex(f.vendorId)}:${hex(f.productId)}`);
    expect([...rules].sort()).toEqual([...table].sort());
  });
});
