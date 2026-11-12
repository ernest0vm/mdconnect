import {
  directoryRecordingFolders,
  type DirectoryHandleLike,
  type OperatingSystem,
  type Platform,
  type PlatformRecordingFolders,
} from '@mdconnect/app';

export interface OsSignals {
  /** `navigator.userAgentData.platform` where the browser provides it (Chromium). */
  readonly userAgentDataPlatform: string | undefined;
  readonly userAgent: string;
}

const UA_DATA_PLATFORMS: Readonly<Record<string, OperatingSystem>> = {
  macOS: 'macos',
  Windows: 'windows',
  Linux: 'linux',
  'Chrome OS': 'chromeos',
  ChromeOS: 'chromeos',
};

/**
 * Maps browser signals to the OS whose USB setup guidance applies. User-agent sniffing is only a
 * fallback; mobile systems map to `other` because they cannot run the desktop setup steps.
 */
export function detectOs({ userAgentDataPlatform, userAgent }: OsSignals): OperatingSystem {
  if (userAgentDataPlatform !== undefined && userAgentDataPlatform !== '') {
    return UA_DATA_PLATFORMS[userAgentDataPlatform] ?? 'other';
  }
  if (/iPhone|iPad|Android/.test(userAgent)) return 'other';
  if (userAgent.includes('CrOS')) return 'chromeos';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'macos';
  if (userAgent.includes('Windows')) return 'windows';
  if (userAgent.includes('Linux')) return 'linux';
  return 'other';
}

/** WebUSB exists only in Chromium-based browsers, and only in a secure context. */
export function isWebUsbSupported({
  secureContext,
  hasUsb,
}: {
  readonly secureContext: boolean;
  readonly hasUsb: boolean;
}): boolean {
  return secureContext && hasUsb;
}

type NavigatorWithUaData = Navigator & {
  readonly userAgentData?: { readonly platform?: string };
};

type WindowWithDirectoryPicker = Window & {
  readonly showDirectoryPicker?: (options: {
    readonly mode: 'readwrite';
    readonly id?: string;
  }) => Promise<DirectoryHandleLike>;
};

/** Folders from the File System Access API, where the browser has it (Chromium); else none. */
function recordingFolders(): PlatformRecordingFolders | undefined {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (picker === undefined) return undefined;
  return directoryRecordingFolders(() =>
    picker.call(window, { mode: 'readwrite', id: 'mdconnect-recordings' }),
  );
}

/** The browser Platform: the browser's own chooser and grants, NetMD devices only. */
export function webPlatform(commit: string, version: string): Platform {
  const nav = navigator as NavigatorWithUaData;
  return {
    kind: 'web',
    os: detectOs({ userAgentDataPlatform: nav.userAgentData?.platform, userAgent: nav.userAgent }),
    usb: navigator.usb,
    deviceKinds: ['netmd'],
    buildCommit: commit,
    version,
    recordingFolders: recordingFolders(),
    appearance: {
      // Browsers expose no platform signal; GlassProvider reads the media queries itself.
      get: () => ({}),
      onChange: () => () => undefined,
    },
  };
}
