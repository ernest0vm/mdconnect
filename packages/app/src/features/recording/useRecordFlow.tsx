import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { PlatformRecordingFolders } from '../../platform';
import { holdWakeLock } from '../../wake-lock';
import type { DiscReader } from '../disc/disc-reader';
import { downloadBlob } from '../disc/download';
import type { LiveCapture } from './capture-source';
import { RecordProgressDialog } from './RecordProgressDialog';
import { RecordSetupDialog } from './RecordSetupDialog';
import {
  recordTracks,
  type RecordingDeck,
  type RecordingProgress,
  type RecordingSave,
  type RecordingSummary,
  type RecordingTrack,
} from './session';
import { useInputLevel } from './useInputLevel';

type Phase =
  | { readonly kind: 'setup'; readonly tracks: readonly RecordingTrack[] }
  | {
      readonly kind: 'recording';
      readonly capture: LiveCapture;
      readonly progress: RecordingProgress | null;
    }
  | { readonly kind: 'summary'; readonly summary: RecordingSummary };

export interface RecordFlowOptions {
  readonly reader: DiscReader;
  readonly trackCount: number;
  /** Where files go; undefined downloads each file instead. */
  readonly folders: PlatformRecordingFolders | undefined;
  /** Called when a recording starts and ends, so the panel can block other work and polling. */
  readonly onRecordingChange: (recording: boolean) => void;
  /**
   * Called with the summary of a recording the device's disconnection ended, which this flow
   * can no longer show because the panel is gone; and with null when a new recording starts.
   */
  readonly onInterrupted?: (summary: RecordingSummary | null) => void;
}

export interface RecordFlow {
  readonly recording: boolean;
  /** Opens the setup for these tracks. */
  readonly record: (tracks: readonly RecordingTrack[]) => void;
  readonly dialogs: ReactNode;
}

/** The deck controls of the reader, each queued with the reader's other work. */
function readerDeck(reader: DiscReader, trackCount: number): RecordingDeck {
  return {
    control: (command) =>
      reader
        .control(command, { track: null, trackCount })
        .then(({ outcome }) => ({ ok: outcome.kind === 'done' })),
    status: () => reader.status(),
  };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Recording selected tracks: the setup dialog, the folder, the recording itself with its progress
 * dialog, and the summary. Unmounting (the device was unplugged) stops a recording as disconnected.
 */
export function useRecordFlow({
  reader,
  trackCount,
  folders,
  onRecordingChange,
  onInterrupted,
}: RecordFlowOptions): RecordFlow {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [stopping, setStopping] = useState(false);
  const controller = useRef<AbortController | null>(null);
  /** The control that opened the setup, where focus returns when the dialogs close. */
  const opener = useRef<HTMLElement | null>(null);
  const returnFocus = () => (opener.current?.isConnected === true ? opener.current : null);
  const level = useInputLevel(phase?.kind === 'recording' ? phase.capture : null);

  useEffect(
    () => () => {
      controller.current?.abort('disconnected');
    },
    [],
  );

  /** Picks where files go, then records; false when the user cancelled the folder picker. */
  const start = async (tracks: readonly RecordingTrack[], capture: LiveCapture) => {
    let save: RecordingSave = { kind: 'download', download: downloadBlob };
    if (folders !== undefined) {
      const folder = await folders.choose();
      if (folder === null) return false;
      save = { kind: 'folder', folder };
    }
    const abort = new AbortController();
    controller.current = abort;
    setStopping(false);
    setPhase({ kind: 'recording', capture, progress: null });
    onRecordingChange(true);
    onInterrupted?.(null);
    const release = await holdWakeLock();
    try {
      const summary = await recordTracks(tracks, {
        deck: readerDeck(reader, trackCount),
        capture,
        trackCount,
        save,
        sleep,
        signal: abort.signal,
        onProgress: (progress) => {
          setPhase((current) =>
            current?.kind === 'recording' ? { ...current, progress } : current,
          );
        },
      });
      if (summary.ending === 'disconnected') onInterrupted?.(summary);
      else setPhase({ kind: 'summary', summary });
    } finally {
      release();
      controller.current = null;
      onRecordingChange(false);
    }
    return true;
  };

  const dialogs =
    phase === null ? null : phase.kind === 'setup' ? (
      <RecordSetupDialog
        tracks={phase.tracks}
        onStart={(capture) => start(phase.tracks, capture)}
        returnFocus={returnFocus}
        onClose={() => {
          setPhase(null);
        }}
      />
    ) : (
      <RecordProgressDialog
        progress={phase.kind === 'recording' ? phase.progress : null}
        level={level}
        summary={phase.kind === 'summary' ? phase.summary : null}
        stopping={stopping}
        onCancel={() => {
          setStopping(true);
          controller.current?.abort('cancelled');
        }}
        onClose={() => {
          setPhase(null);
        }}
        returnFocus={returnFocus}
      />
    );

  return {
    recording: phase?.kind === 'recording',
    record: (tracks) => {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPhase({ kind: 'setup', tracks });
    },
    dialogs,
  };
}
