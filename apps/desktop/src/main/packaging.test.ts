import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const builderConfig = readFileSync(join(import.meta.dirname, '../../electron-builder.yml'), 'utf8');

/** The lines of a top-level YAML block, such as `mac:`, up to the next top-level key. */
function topLevelBlock(text: string, key: string): string {
  const lines = text.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^\S/u.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

describe('macOS packaging (desktop-shell: "macOS asks once")', () => {
  it('declares why the app uses the audio input, so macOS asks instead of quitting the app', () => {
    const mac = topLevelBlock(builderConfig, 'mac');
    expect(mac).toMatch(
      /^ {2}extendInfo:\n(?: {4}.*\n)*? {4}NSMicrophoneUsageDescription: .{20,}/mu,
    );
  });
});
