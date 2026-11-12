import type { Song } from '@mdconnect/core';

import type {
  AppearancePayload,
  ChooseDeviceRequestPayload,
  DesktopOs,
  RecordingFilePayload,
  RecordingFolderPayload,
} from './ipc';

/** The only privileged API the renderer sees, exposed by the preload as `window.mdconnect`. */
export interface MdconnectBridge {
  readonly os: DesktopOs;
  readonly usb: {
    onChooseDevice(callback: (request: ChooseDeviceRequestPayload) => void): () => void;
    respondChooseDevice(requestId: string, deviceId: string | null): void;
  };
  readonly appearance: {
    get(): AppearancePayload;
    onChange(callback: (signals: AppearancePayload) => void): () => void;
  };
  /**
   * A folder the user picks for recordings, and files written into it in parts; only opaque ids
   * and names cross the bridge, never a path.
   */
  readonly recordings: {
    chooseFolder(): Promise<RecordingFolderPayload | null>;
    create(folderId: string, fileName: string): Promise<RecordingFilePayload>;
    append(fileId: string, bytes: Uint8Array): Promise<void>;
    finish(fileId: string): Promise<void>;
    discard(fileId: string): Promise<void>;
  };
  /** Song recognition calls the page cannot make itself; Shazam refuses web pages. */
  readonly recognition: {
    /** Asks Shazam about a signature; the song found, or null. */
    shazam(signature: { readonly uri: string; readonly sampleMs: number }): Promise<Song | null>;
  };
}
