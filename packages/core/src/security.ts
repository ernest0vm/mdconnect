/**
 * Production Content Security Policy shared by both shells: the desktop `app://` protocol handler
 * sends it as a response header, and the web app's `vercel.json` must match it exactly.
 * `style-src 'unsafe-inline'` is required by inline `style` attributes in Radix and GlassyUI.
 */
/** The online ATRAC encoding service (thinkbrown/atrac-api, as webminidisc uses). */
export const ONLINE_ENCODER_ORIGIN = 'https://atrac.minidisc.wiki';

export type CspDirectives = Readonly<Record<string, readonly string[]>>;

export const CSP_DIRECTIVES: CspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  // The online ATRAC encoder, used only after the user agrees to send audio to it.
  'connect-src': ["'self'", ONLINE_ENCODER_ORIGIN],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
};

/** Serialises directives in insertion order, so shells can extend the shared policy safely. */
export function buildCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...sources].join(' '))
    .join('; ');
}

export const contentSecurityPolicy = buildCsp(CSP_DIRECTIVES);
