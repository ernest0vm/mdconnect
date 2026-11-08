/**
 * Production Content Security Policy shared by both shells: the desktop `app://` protocol handler
 * sends it as a response header, and the web app's `vercel.json` must match it exactly.
 * `style-src 'unsafe-inline'` is required by inline `style` attributes in Radix and GlassyUI.
 */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');
