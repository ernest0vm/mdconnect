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

export function isAppOrigin(origin: string, context: OriginContext): boolean {
  if (origin === APP_ORIGIN) return true;
  if (context.packaged || context.devServerUrl === undefined) return false;
  return URL.canParse(context.devServerUrl) && origin === new URL(context.devServerUrl).origin;
}
