import type { Disc } from '@mdconnect/netmd';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';

import type { UsbDeviceHandle } from '../../platform';
import { holdWakeLock } from '../../wake-lock';
import { Action } from '../disc/Action';
import type { DiscReader, UploadResult } from '../disc/disc-reader';
import { ConvertDialog, type UploadJob } from './ConvertDialog';
import { convertTrack } from './convert-track';
import { UploadDialog, type UploadProgress } from './UploadDialog';
import { runUpload } from './upload-pipeline';
import { useUploadPreferences } from './UploadPreferencesContext';
import {
  addTracksBlocker,
  audioFiles,
  preparedTitles,
  progressAfter,
  recordingModes,
  skippedLine,
  startingProgress,
  summaryText,
} from './upload-view';

/** How often progress reaches the screen: one event arrives per 1 KB packet. */
const PROGRESS_INTERVAL_MS = 150;

export interface UploadFlowOptions {
  readonly reader: DiscReader;
  readonly device: UsbDeviceHandle;
  /** The disc as read; null while it is not shown. */
  readonly disc: Disc | null;
  /** Another change is being saved or the disc is being read. */
  readonly busy: boolean;
  /** A recording is running; adding tracks waits for it. */
  readonly recording?: boolean;
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
  recording = false,
  onFinished,
}: UploadFlowOptions): UploadFlow {
  const { preferences, setPreferences: remember } = useUploadPreferences();
  const [files, setFiles] = useState<readonly File[] | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const reasonId = useId();
  const cancelled = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A file dropped outside the disc panel (on a dialog or the page) would otherwise open in the
  // tab and end the session; the panel's own handlers still decide what a drop on it does.
  useEffect(() => {
    const guard = (event: globalThis.DragEvent) => {
      if (event.defaultPrevented || event.dataTransfer?.types.includes('Files') !== true) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragover', guard);
    window.addEventListener('drop', guard);
    return () => {
      window.removeEventListener('dragover', guard);
      window.removeEventListener('drop', guard);
    };
  }, []);

  const uploading = progress !== null && progress.finished === null;
  const blocker = addTracksBlocker({
    writeProtected: disc?.writeProtected ?? false,
    busy: busy || uploading,
    recording,
  });
  const modes = useMemo(() => recordingModes(device.vendorId, device.productId), [device]);

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
    setRefusal(null);
    // Files found unusable while the dialog read them are skipped without trying again; they take
    // no title space and do not count as tracks to upload.
    const items = job.items.filter((item) => item.problem === null);
    const knownSkips = job.items.flatMap((item) =>
      item.problem === null ? [] : [skippedLine(item.title || item.file.name, item.problem)],
    );
    const titles = preparedTitles(items, disc, job.preferences.fullWidth);
    // An empty title is shown as the file it came from.
    const shownTitles = titles.map((t, i) =>
      t.title === '' ? (items[i]?.file.name ?? '') : t.title,
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

    const run = async (): Promise<string[]> => {
      const release = await holdWakeLock();
      try {
        const result = await reader.upload((session) =>
          runUpload(titles, {
            convert: (index, _onProgress, signal) => {
              const item = items[index];
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
        if (mounted.current) onFinished(result);
        if (result.outcome.kind === 'failed') {
          return ['Nothing was uploaded: the device could not be reached.'];
        }
        const [first = '', ...rest] = summaryText(result.outcome.summary, shownTitles);
        return [first, ...knownSkips, ...rest];
      } finally {
        release();
      }
    };
    void run()
      .catch(() => ['The upload stopped unexpectedly. Refresh to see what reached the disc.'])
      .then((finished) => {
        clearInterval(flush);
        if (mounted.current) setProgress({ ...latest, stopping: cancelled.current, finished });
      });
  };

  const addTracks = (
    <>
      <Action
        label="Add tracks"
        blocked={blocker !== null || disc === null}
        describedBy={reasonId}
        onRun={() => input.current?.click()}
      />
      {blocker !== null && (
        <span id={reasonId} className="sr-only">
          {blocker}
        </span>
      )}
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
            setRefusal(null);
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
