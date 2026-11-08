import { shell, type Session, type WebContents, type WebPreferences } from 'electron';

import { developmentCsp } from './csp';
import { isSafeExternalUrl } from './url-policy';

export const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  webviewTag: false,
} as const satisfies WebPreferences;

/** The window never navigates and never opens windows; web links go to the default browser. */
export function lockNavigation(contents: WebContents): void {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  contents.on('will-redirect', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** USB is granted through device permissions (usb.ts); every other permission request is denied. */
export function denyPermissionRequests(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
}

export function applyDevelopmentCsp(session: Session): void {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [developmentCsp()],
      },
    });
  });
}
