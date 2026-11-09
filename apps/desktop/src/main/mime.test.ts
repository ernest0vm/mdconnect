import { describe, expect, it } from 'vitest';

import { mimeTypeFor } from './mime';

describe('mimeTypeFor', () => {
  it.each([
    ['index.html', 'text/html; charset=utf-8'],
    ['assets/app.js', 'text/javascript; charset=utf-8'],
    ['assets/app.css', 'text/css; charset=utf-8'],
    ['assets/encoder.wasm', 'application/wasm'],
    ['assets/icon.svg', 'image/svg+xml'],
    ['assets/font.woff2', 'font/woff2'],
  ])('serves %s as %s', (file, type) => {
    expect(mimeTypeFor(file)).toBe(type);
  });

  it('falls back to a generic binary type', () => {
    expect(mimeTypeFor('assets/blob.unknown')).toBe('application/octet-stream');
  });
});
