import type { Session } from 'electron';

import { isAppOrigin, type OriginContext } from './url-policy';

/** What Electron passes about a permission check that the decision needs. */
export interface CheckDetails {
  readonly mediaType?: string;
}

/** What Electron passes about a permission request that the decision needs. */
export interface RequestDetails {
  readonly mediaTypes?: readonly string[];
  readonly securityOrigin?: string;
  readonly requestingUrl?: string;
}

/**
 * Whether the app's page holds a permission: USB (devices are then vetted one by one in usb.ts)
 * and audio capture, for the app origin only. Video, other permissions and other origins are not.
 */
export function permissionCheck(
  permission: string,
  requestingOrigin: string,
  details: CheckDetails,
  origins: OriginContext,
): boolean {
  if (!isAppOrigin(requestingOrigin, origins)) return false;
  if (permission === 'usb') return true;
  return permission === 'media' && details.mediaType === 'audio';
}

/** Whether to grant a permission request: only audio capture, without video, from the app origin. */
export function permissionRequest(
  permission: string,
  details: RequestDetails,
  origins: OriginContext,
): boolean {
  if (permission !== 'media') return false;
  const types = details.mediaTypes ?? [];
  if (types.length === 0 || !types.every((type) => type === 'audio')) return false;
  const origin = details.securityOrigin ?? requestOrigin(details.requestingUrl);
  return origin !== null && isAppOrigin(origin, origins);
}

function requestOrigin(url: string | undefined): string | null {
  return url !== undefined && URL.canParse(url) ? new URL(url).origin : null;
}

/** Installs both permission handlers on the session; Electron keeps one of each. */
export function installPermissionHandlers(session: Session, origins: OriginContext): void {
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) =>
    permissionCheck(permission, requestingOrigin, details, origins),
  );
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permissionRequest(permission, details, origins));
  });
}
