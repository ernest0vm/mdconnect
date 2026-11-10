import type { Disc } from '@mdconnect/netmd';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';

import type { UsbDeviceHandle } from '../../platform';
import { Action } from '../disc/Action';
import type { DiscReader, UploadResult } from '../disc/disc-reader';
import { ConvertDialog, type UploadJob } from './ConvertDialog';
import { convertTrack } from './convert-track';
import { UploadDialog, type UploadProgress } from './UploadDialog';
import { runUpload } from './upload-pipeline';
import { createUploadPreferencesStore, type UploadPreferences } from './upload-preferences';
import {
  addTracksBlocker,
  audioFiles,
  preparedTitles,
  progressAfter,
  recordingModes,
  startingProgress,
  summaryText,
} from './upload-view';

/** How often progress reaches the screen: one event arrives per 1 KB packet. */
const PROGRESS_INTERVAL_MS = 150;

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Keeps the screen on while an upload runs, where the platform allows it. */
async function holdWakeLock(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock.request('screen');
    return () => {
      void lock.release();
    };
  } catch {
    return () => undefined;
  }
}

export interface UploadFlowOptions {
  readonly reader: DiscReader;
  readonly device: UsbDeviceHandle;
  /** The disc as read; null while it is not shown. */
  readonly disc: Disc | null;
  /** Another change is being saved or the disc is being read. */
  readonly busy: boolean;
  /** Called with the disc read after the upload. */
  readonly onFinished: (result: UploadResult) => void;
}

export interface UploadFlow {
  readonly uploading: boolean;
  /** The "Add tracks" button. */
  readonly addTracks: ReactNode;
  /** Handlers that make the disc panel a drop target for audio files. */
  readonly dropZone: {
    readonly onDragOver: (event: DragEvent) => void;
    readonly onDragLeave: (event: DragEvent) => void;
    readonly onDrop: (event: DragEvent) => void;
  };
  readonly dragging: boolean;
  /** Why dropped files were refused, for the disc's notice area. */
  readonly notice: ReactNode;
  readonly dialogs: ReactNode;
}

/**
 * Adding tracks: the button, dropping files on the disc, the convert dialog and the upload with
 * its progress. The upload runs on the reader's queue, so nothing else talks to the device.
 */
export function useUploadFlow({
  reader,
  device,
  disc,
  busy,
  onFinished,
}: UploadFlowOptions): UploadFlow {
  const store = useMemo(() => createUploadPreferencesStore(browserStorage()), []);
  const [preferences, setPreferences] = useState<UploadPreferences>(() => store.load());
  const [files, setFiles] = useState<readonly File[] | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const uploading = progress !== null && progress.finished === null;
  const blocker = addTracksBlocker({
    writeProtected: disc?.writeProtected ?? false,
    busy: busy || uploading,
  });
  const modes = useMemo(() => recordingModes(device.vendorId, device.productId), [device]);

  const remember = useCallback(
    (next: UploadPreferences) => {
      setPreferences(next);
      store.save(next);
    },
    [store],
  );

  /** Opens the convert dialog with the audio among `picked`, or says why it cannot. */
  const offer = (picked: readonly File[]) => {
    if (disc === null || picked.length === 0) return;
    if (blocker !== null) {
      setRefusal(blocker);
      return;
    }
    const { accepted, rejected } = audioFiles(picked);
    setRefusal(
      rejected.length === 0
        ? null
        : `Not audio, so not added: ${rejected.map((name) => `“${name}”`).join(', ')}.`,
    );
    if (accepted.length > 0) setFiles(accepted);
  };

  const start = (job: UploadJob) => {
    if (disc === null) return;
    remember(job.preferences);
    setFiles(null);
    const titles = preparedTitles(job.items, disc, job.preferences.fullWidth);
    // An empty title is shown as the file it came from.
    const shownTitles = titles.map((t, i) =>
      t.title === '' ? (job.items[i]?.file.name ?? '') : t.title,
    );
    let latest = startingProgress(shownTitles);
    setProgress(latest);
    cancelled.current = false;
    const flush = setInterval(() => {
      if (!mounted.current) return;
      setProgress((shown) =>
        (shown?.finished ?? null) === null ? { ...latest, stopping: cancelled.current } : shown,
      );
    }, PROGRESS_INTERVAL_MS);
    const { encoder, replayGain } = job.preferences;

    void holdWakeLock().then(async (release) => {
      const result = await reader.upload((session) =>
        runUpload(titles, {
          convert: (index, _onProgress, signal) => {
            const item = job.items[index];
            if (item === undefined) return Promise.reject(new Error('No such track'));
            return convertTrack(item.file, job.mode, {
              encoder,
              replayGain,
              trackGainDb: item.tags?.trackGainDb,
              signal,
            });
          },
          session,
          isCancelled: () => cancelled.current,
          onEvent: (event) => {
            latest = progressAfter(latest, event, shownTitles);
          },
        }),
      );
      clearInterval(flush);
      release();
      if (!mounted.current) return;
      const finished =
        result.outcome.kind === 'done'
          ? summaryText(result.outcome.summary, shownTitles)
          : ['Nothing was uploaded: the device could not be reached.'];
      setProgress({ ...latest, stopping: cancelled.current, finished });
      onFinished(result);
    });
  };

  const addTracks = (
    <>
      <Action
        label="Add tracks"
        blocked={blocker !== null || disc === null}
        onRun={() => input.current?.click()}
      />
      <input
        ref={input}
        type="file"
        multiple
        accept="audio/*,.oma,.at3,.flac,.m4a,.opus"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          offer([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
    </>
  );

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');
  const dropZone = {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = blocker === null ? 'copy' : 'none';
      setDragging(true);
    },
    onDragLeave: (event: DragEvent) => {
      // Moving between children fires leave on the parent; only leaving the zone counts.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDragging(false);
      offer([...event.dataTransfer.files]);
    },
  };

  const notice =
    refusal === null ? null : (
      <GlassAlert tone="warning" title="Files not added">
        <p>{refusal}</p>
      </GlassAlert>
    );

  const dialogs = (
    <>
      {files !== null && disc !== null && (
        <ConvertDialog
          files={files}
          disc={disc}
          modes={modes}
          preferences={preferences}
          onUpload={start}
          onPreferences={remember}
          onClose={() => {
            setFiles(null);
          }}
        />
      )}
      {progress !== null && (
        <UploadDialog
          progress={progress}
          onCancel={() => {
            cancelled.current = true;
            setProgress((shown) => (shown === null ? shown : { ...shown, stopping: true }));
          }}
          onClose={() => {
            setProgress(null);
          }}
        />
      )}
    </>
  );

  return { uploading, addTracks, dropZone, dragging, notice, dialogs };
}
