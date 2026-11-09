/** The secure origin the packaged renderer is served from (see app-protocol.ts). */
export const APP_ORIGIN = 'app://mdconnect';

const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

/** Only web links may leave the app, and only to the default browser. */
export function isSafeExternalUrl(url: string): boolean {
  if (!URL.canParse(url)) return false;
  return EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
}

export interface OriginContext {
  readonly packaged: boolean;
  /** electron-vite's dev-server URL (`ELECTRON_RENDERER_URL`), present only in development. */
  readonly devServerUrl: string | undefined;
}

/**
 * True for the app's own origin; the dev-server origin counts only in unpackaged development.
 * Electron's permission check handler passes the origin with a trailing slash (`app://mdconnect/`)
 * while the device permission handler passes it without one, so one trailing slash is ignored.
 */
export function isAppOrigin(origin: string, context: OriginContext): boolean {
  const bare = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  if (bare === APP_ORIGIN) return true;
  if (context.packaged || context.devServerUrl === undefined) return false;
  return URL.canParse(context.devServerUrl) && bare === new URL(context.devServerUrl).origin;
}
