import { join } from 'node:path';

import { app, BrowserWindow, ipcMain, nativeTheme, session } from 'electron';

import { IPC, type AppearancePayload } from '../shared/ipc';
import { registerAppScheme, serveAppProtocol } from './app-protocol';
import { ChooserBridge } from './chooser-bridge';
import {
  applyDevelopmentCsp,
  denyPermissionRequests,
  lockNavigation,
  SECURE_WEB_PREFERENCES,
} from './security';
import { APP_ORIGIN, type OriginContext } from './url-policy';
import { installUsbHandlers } from './usb';

// electron-vite sets ELECTRON_RENDERER_URL in development; an empty value means "not set".
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const devServerUrl =
  app.isPackaged || rendererUrl === undefined || rendererUrl === '' ? undefined : rendererUrl;
const origins: OriginContext = { packaged: app.isPackaged, devServerUrl };

let mainWindow: BrowserWindow | null = null;

const bridge = new ChooserBridge((request) => {
  if (mainWindow === null) return false;
  mainWindow.webContents.send(IPC.chooseDevice, request);
  return true;
});

registerAppScheme();
app.enableSandbox();

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', showMainWindow);
  app.on('activate', showMainWindow);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  void app.whenReady().then(start);
} else {
  app.quit();
}

function start(): void {
  nativeTheme.themeSource = 'system';
  const defaultSession = session.defaultSession;
  denyPermissionRequests(defaultSession);
  if (devServerUrl !== undefined) applyDevelopmentCsp(defaultSession);
  serveAppProtocol(join(import.meta.dirname, '../renderer'));
  installUsbHandlers(defaultSession, bridge, origins);
  forwardAppearance();
  showMainWindow();
}

/** Restores and focuses the main window, or creates it when none exists (macOS relaunch). */
function showMainWindow(): void {
  if (!app.isReady()) return;
  if (mainWindow === null) {
    mainWindow = createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Creates the hardened main window. Reloads and closing cancel a pending chooser request so
 * Electron's `select-usb-device` callback is always answered.
 */
function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    title: 'mdconnect',
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: join(import.meta.dirname, '../preload/index.cjs'),
    },
  });
  lockNavigation(window.webContents);
  window.once('ready-to-show', () => {
    window.show();
  });
  window.webContents.on('did-start-loading', () => {
    bridge.cancelPending();
  });
  window.on('closed', () => {
    bridge.cancelPending();
    mainWindow = null;
  });
  void window.loadURL(devServerUrl ?? `${APP_ORIGIN}/index.html`);
  return window;
}

function appearancePayload(): AppearancePayload {
  return { prefersReducedTransparency: nativeTheme.prefersReducedTransparency };
}

function forwardAppearance(): void {
  ipcMain.on(IPC.appearanceGet, (event) => {
    event.returnValue = appearancePayload();
  });
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send(IPC.appearanceChanged, appearancePayload());
  });
}
