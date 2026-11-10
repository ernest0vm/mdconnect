import type { DeviceStatus, Disc } from '@mdconnect/netmd';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import { GlassMeter } from '@mdconnect/ui/components/glassyui/glass-meter';
import { GlassPanel } from '@mdconnect/ui/components/glassyui/glass-panel';
import { GlassSpinner } from '@mdconnect/ui/components/glassyui/glass-spinner';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { UsbDeviceHandle } from '../../platform';
import { Action } from './Action';
import { csvFileName, formatCsv, importPlan, parseCsv, reviewImport, type CsvRow } from './csv';
import { DeleteDialog } from './DeleteDialog';
import { DiscMenu, menuTrigger } from './DiscMenu';
import { downloadText } from './download';
import { ImportDialog } from './ImportDialog';
import { menuAvailability } from './menu-view';
import { WipeDialog } from './WipeDialog';
import {
  DiscReader,
  openNetMdSession,
  type DiscReadResult,
  type PlaybackCommand,
} from './disc-reader';
import { discStatus } from './disc-status';
import type { DiscView } from './disc-view';
import {
  deleteTracksPlan,
  groupTracksPlan,
  moveTrackPlan,
  renameDiscPlan,
  renameGroupPlan,
  renameTrackPlan,
  ungroupPlan,
  wipeDiscPlan,
  type EditPlan,
} from './edit-plan';
import {
  editBlocker,
  editFailureMessage,
  groupBlocker,
  planBlocker,
  selectAllState,
  selectionLabel,
  toggleTrack,
  trackCountLabel,
  type Selection,
} from './editing';
import { isHiMdMode } from './hi-md-mode';
import { PlayerBar } from './PlayerBar';
import {
  controlFailureMessage,
  mergeStatus,
  playerBlocker,
  playerView,
  trackPlayState,
} from './player-view';
import { browserClock, documentVisibility, StatusPoller } from './status-poller';
import { TitleDialog } from './TitleDialog';
import { TrackTable } from './TrackTable';
import { useUploadFlow, type UploadFlow } from '../upload/useUploadFlow';

type Dialog =
  | { readonly kind: 'rename-disc' }
  | { readonly kind: 'rename-track'; readonly index: number }
  | { readonly kind: 'new-group'; readonly tracks: readonly number[] }
  | { readonly kind: 'rename-group'; readonly track: number }
  | { readonly kind: 'delete'; readonly tracks: readonly number[] };

/** The two grid areas the disc fills in the connected layout: its summary and its tracks. */
function DiscAreas({
  summary,
  tracks,
  busy,
  upload,
}: {
  readonly summary: ReactNode;
  readonly tracks: ReactNode;
  readonly busy: boolean;
  /** Makes both areas a drop target for audio files. */
  readonly upload?: Pick<UploadFlow, 'dropZone' | 'dragging'>;
}) {
  // Outlines both areas while files are dragged over them.
  const dropTarget =
    upload?.dragging === true
      ? 'outline-2 outline-dashed outline-indigo-600 dark:outline-indigo-300'
      : '';
  return (
    <>
      <GlassPanel
        role="region"
        aria-label="Disc"
        // It scrolls on its own in two columns; scrollable regions must be reachable by keyboard.
        tabIndex={0}
        className={`flex shrink-0 flex-col gap-3 p-4 lg:min-h-0 lg:overflow-y-auto ${dropTarget}`}
        {...upload?.dropZone}
      >
        {summary}
      </GlassPanel>
      <GlassPanel
        role="region"
        aria-label="Tracks"
        aria-busy={busy}
        className={`flex min-h-96 flex-1 flex-col gap-3 p-4 lg:min-h-0 ${dropTarget}`}
        {...upload?.dropZone}
      >
        {tracks}
      </GlassPanel>
    </>
  );
}

interface EditorProps {
  readonly disc: DiscView;
  readonly raw: Disc;
  readonly busy: boolean;
  readonly onEdit: (plan: EditPlan, selectAfter?: Selection) => void;
  readonly notice: ReactNode;
  /** The Refresh button, which belongs in the summary. */
  readonly refresh: ReactNode;
  /** The player bar, at the bottom of the summary. */
  readonly player: ReactNode;
  readonly deviceStatus: DeviceStatus | null;
  /** Whether the player controls are unavailable. */
  readonly playBlocked: boolean;
  readonly onControl: (command: PlaybackCommand) => void;
  /** Adding tracks: the button, the drop target and its state. */
  readonly upload: UploadFlow;
}

/** The disc with its edit actions, selection and dialogs; it turns user actions into edit plans. */
function DiscEditor({
  disc,
  raw,
  busy,
  onEdit,
  notice,
  refresh,
  player,
  deviceStatus,
  playBlocked,
  onControl,
  upload,
}: EditorProps) {
  const [chosen, setSelection] = useState<Selection>(new Set());
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const reasonId = useId();
  const blocker = editBlocker({ writeProtected: raw.writeProtected, busy });
  const locked = blocker !== null;
  // Tracks that no longer exist after the disc is read again drop out of the selection.
  const selection = useMemo<Selection>(
    () => new Set([...chosen].filter((index) => index < raw.trackCount)),
    [chosen, raw.trackCount],
  );

  const selected = [...selection];
  const single = selected.length === 1 ? selected[0] : undefined;
  const grouping = groupTracksPlan(raw, selected, 'check');
  const allState = selectAllState(selection, raw.trackCount);

  /** Runs a plan, closes any dialog and optionally moves the selection. */
  const edit = (plan: EditPlan, selectAfter?: Selection) => {
    setDialog(null);
    onEdit(plan, selectAfter);
    if (selectAfter) setSelection(selectAfter);
  };
  /** Moves a track to a valid position and keeps it selected. */
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= raw.trackCount) return;
    edit(moveTrackPlan(raw, from, to), new Set([to]));
  };
  const summary = (
    <>
      {/* Disc titles often have no spaces (`A/B/C`); let them wrap anywhere instead of overflowing. */}
      <h2
        className={[
          'min-w-0 [overflow-wrap:anywhere]',
          disc.title === null ? 'text-lg italic' : 'text-lg font-semibold',
        ].join(' ')}
      >
        {disc.title ?? 'Untitled disc'}
      </h2>
      {disc.subtitle !== null && <p className="-mt-2 text-sm opacity-80">{disc.subtitle}</p>}
      {disc.writeProtected && (
        <div>
          <GlassBadge tone="orange">Write-protected</GlassBadge>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <GlassMeter
          label="Disc space"
          value={disc.capacityMeter.value}
          max={disc.capacityMeter.max}
          valueText={disc.capacityMeter.text}
        />
        <p className="text-sm">
          {disc.capacity.used} used · {disc.capacity.free} free · {disc.capacity.total} total
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Action
          label="Rename disc"
          blocked={locked}
          describedBy={reasonId}
          onRun={() => {
            setDialog({ kind: 'rename-disc' });
          }}
        />
        {upload.addTracks}
        {refresh}
      </div>
      {notice}
      {player}
    </>
  );

  const tracks =
    disc.groups.length === 0 ? (
      <p className="text-sm opacity-80">This disc is blank.</p>
    ) : (
      <>
        <div
          role="toolbar"
          aria-label="Track actions"
          className="flex flex-wrap items-center gap-2"
        >
          <label className="flex items-center gap-2 text-sm">
            <GlassCheckbox
              checked={allState === 'all'}
              indeterminate={allState === 'some'}
              onChange={() => {
                setSelection(
                  allState === 'all'
                    ? new Set()
                    : new Set(Array.from({ length: raw.trackCount }, (_, i) => i)),
                );
              }}
            />
            <span aria-live="polite">{selectionLabel(selection)}</span>
          </label>
          {selection.size > 0 && (
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelection(new Set());
              }}
            >
              Clear
            </GlassButton>
          )}
          <Action
            label="Rename"
            blocked={locked || single === undefined}
            describedBy={reasonId}
            onRun={() => {
              if (single !== undefined) setDialog({ kind: 'rename-track', index: single });
            }}
          />
          <Action
            label="Move up"
            blocked={locked || single === undefined || single === 0}
            describedBy={reasonId}
            onRun={() => {
              if (single !== undefined) move(single, single - 1);
            }}
          />
          <Action
            label="Move down"
            blocked={locked || single === undefined || single === raw.trackCount - 1}
            describedBy={reasonId}
            onRun={() => {
              if (single !== undefined) move(single, single + 1);
            }}
          />
          <Action
            label="Group"
            blocked={locked || grouping.kind !== 'plan'}
            describedBy={
              grouping.kind === 'invalid' && selection.size > 0 ? `${reasonId}-group` : reasonId
            }
            onRun={() => {
              setDialog({ kind: 'new-group', tracks: selected });
            }}
          />
          <Action
            label="Delete"
            blocked={locked || selection.size === 0}
            describedBy={reasonId}
            onRun={() => {
              setDialog({ kind: 'delete', tracks: selected });
            }}
          />
        </div>
        <p id={reasonId} className="text-xs opacity-80">
          {blocker ?? 'Select tracks to edit them, or drag a track to move it.'}
        </p>
        {grouping.kind === 'invalid' && selection.size > 0 && (
          <p id={`${reasonId}-group`} className="sr-only">
            {groupBlocker(grouping.reason)}
          </p>
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          // Scrollable regions must be reachable by keyboard.
          tabIndex={0}
          aria-label="Track list"
        >
          <TrackTable
            disc={disc}
            selection={selection}
            locked={locked}
            reasonId={reasonId}
            onToggle={(index) => {
              setSelection((current) => toggleTrack(current, index));
            }}
            onMove={move}
            onRenameGroup={(track) => {
              setDialog({ kind: 'rename-group', track });
            }}
            onUngroup={(track) => {
              edit(ungroupPlan(raw, track));
            }}
            playState={(track) => trackPlayState(deviceStatus, track)}
            playBlocked={playBlocked}
            onPlay={(track) => {
              const state = trackPlayState(deviceStatus, track);
              if (state === 'playing') onControl({ kind: 'pause' });
              else if (state === 'paused') onControl({ kind: 'play' });
              else onControl({ kind: 'playTrack', track });
            }}
          />
        </div>
      </>
    );

  return (
    <>
      <DiscAreas summary={summary} tracks={tracks} busy={busy} upload={upload} />
      {dialog?.kind === 'rename-disc' && (
        <TitleDialog
          disc={raw}
          target={{ kind: 'disc' }}
          heading="Rename disc"
          saveLabel="Rename"
          onClose={() => {
            setDialog(null);
          }}
          onSave={(form) => {
            edit(
              renameDiscPlan(form.halfWidth, form.fullWidthChanged ? form.fullWidth : undefined),
            );
          }}
        />
      )}
      {dialog?.kind === 'rename-track' && (
        <TitleDialog
          disc={raw}
          target={{ kind: 'track', index: dialog.index }}
          heading={`Rename track ${String(dialog.index + 1)}`}
          saveLabel="Rename"
          onClose={() => {
            setDialog(null);
          }}
          onSave={(form) => {
            edit(
              renameTrackPlan(
                dialog.index,
                form.halfWidth,
                form.fullWidthChanged ? form.fullWidth : undefined,
              ),
            );
          }}
        />
      )}
      {dialog?.kind === 'new-group' && (
        <TitleDialog
          disc={raw}
          target={{ kind: 'new-group', tracks: dialog.tracks }}
          heading={`Group ${trackCountLabel(dialog.tracks.length)}`}
          saveLabel="Group"
          onClose={() => {
            setDialog(null);
          }}
          onSave={(form) => {
            const plan = groupTracksPlan(raw, dialog.tracks, form.halfWidth, form.fullWidth);
            if (plan.kind === 'plan') edit(plan, new Set());
          }}
        />
      )}
      {dialog?.kind === 'rename-group' && (
        <TitleDialog
          disc={raw}
          target={{ kind: 'group', track: dialog.track }}
          heading="Rename group"
          saveLabel="Rename"
          onClose={() => {
            setDialog(null);
          }}
          onSave={(form) => {
            edit(
              renameGroupPlan(
                raw,
                dialog.track,
                form.halfWidth,
                form.fullWidthChanged ? form.fullWidth : undefined,
              ),
            );
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog
          count={dialog.tracks.length}
          onClose={() => {
            setDialog(null);
          }}
          onConfirm={() => {
            edit(deleteTracksPlan(raw, dialog.tracks), new Set());
          }}
        />
      )}
    </>
  );
}

type EditState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly message: string };

/** What DiscPanel needs: the open device and the header's menu slot and callbacks. */
export interface DiscPanelProps {
  readonly device: UsbDeviceHandle;
  /** Where the More menu goes: a slot in the page header. */
  readonly menuSlot?: HTMLElement | null;
  /** Called when the user chooses About in the menu. */
  readonly onAbout?: () => void;
  /** Called once the session with the device has ended after Exit. */
  readonly onExit?: (device: UsbDeviceHandle) => void;
}

type MenuDialog =
  | { readonly kind: 'wipe' }
  | {
      readonly kind: 'import';
      readonly fileName: string;
      readonly parsed: { readonly rows: readonly CsvRow[] };
    };

/** Reads the disc in the open device, shows it, and edits it; puts the More menu in the header. */
export function DiscPanel({ device, menuSlot = null, onAbout, onExit }: DiscPanelProps) {
  const reader = useMemo(
    () =>
      new DiscReader(() => openNetMdSession(device), {
        hiMdMode: () => isHiMdMode(device),
      }),
    [device],
  );
  const [result, setResult] = useState<DiscReadResult | 'reading'>('reading');
  const [generation, setGeneration] = useState(0);
  const [editState, setEditState] = useState<EditState>({ kind: 'idle' });
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [menuDialog, setMenuDialog] = useState<MenuDialog | null>(null);
  /** Why a chosen CSV cannot be imported; kept apart from editState so a save stays locked. */
  const [importError, setImportError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const mounted = useRef(true);

  // Keep the player current while the app is visible; reads share the device queue. Only a
  // device whose disc could be read (or that has no disc) is polled: one in use, in Hi-MD mode or
  // failing would be reopened every second.
  const pollable = result !== 'reading' && (result.kind === 'disc' || result.kind === 'no-disc');
  useEffect(() => {
    if (!pollable) return;
    const poller = new StatusPoller(
      () => reader.status(),
      (next) => {
        setDeviceStatus((shown) => mergeStatus(shown, next));
      },
      browserClock,
      documentVisibility,
    );
    poller.start();
    return () => {
      poller.stop();
    };
  }, [reader, pollable]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // After an unplug the panel is gone; a late result must not show anything.
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    void reader.read().then((next) => {
      if (current) {
        setResult(next);
        // A read cannot tell that the earlier status belongs to this disc: the next poll sets it.
        setDeviceStatus(null);
      }
    });
    return () => {
      current = false;
    };
  }, [reader, generation]);

  // The disc and reading states render different trees, so the Refresh button is a new element
  // after each transition. When the user pressed it, focus moves to each new one until the read ends.
  const keepRefreshFocus = useRef(false);
  const focusNewRefresh = useCallback((button: HTMLButtonElement | null) => {
    if (button !== null && keepRefreshFocus.current) button.focus();
  }, []);
  useEffect(() => {
    if (result !== 'reading') keepRefreshFocus.current = false;
  }, [result]);

  const refresh = useCallback(() => {
    setResult('reading');
    setEditState({ kind: 'idle' });
    setGeneration((n) => n + 1);
  }, []);

  const runEdit = useCallback(
    (plan: EditPlan) => {
      if (plan.commands.length === 0) return;
      const blocked = planBlocker(plan);
      if (blocked !== null) {
        setEditState({ kind: 'failed', message: blocked });
        return;
      }
      setImportError(null);
      setEditState({ kind: 'saving' });
      void reader.edit(plan).then(({ outcome, result: next }) => {
        if (!mounted.current) return;
        setResult(next);
        // A read cannot tell that the earlier status belongs to this disc: the next poll sets it.
        setDeviceStatus(null);
        setEditState(
          outcome.kind === 'saved'
            ? { kind: 'saved' }
            : { kind: 'failed', message: editFailureMessage(outcome.reason) },
        );
      });
    },
    [reader],
  );

  const status = discStatus(result);
  const saving = editState.kind === 'saving';
  const upload = useUploadFlow({
    reader,
    device,
    disc: status.kind === 'disc' ? status.raw : null,
    busy: saving || status.kind === 'reading',
    onFinished: ({ result: next }) => {
      setResult(next);
      // A read cannot tell that the earlier status belongs to this disc: the next poll sets it.
      setDeviceStatus(null);
    },
  });
  const editNotice =
    editState.kind === 'failed' ? (
      <GlassAlert tone="warning" title="Change not saved">
        <p>{editState.message}</p>
      </GlassAlert>
    ) : editState.kind === 'saved' ? (
      <p role="status" className="text-xs opacity-80">
        Saved. The device writes changes to the disc when it stops or the disc is ejected.
      </p>
    ) : saving ? (
      <GlassSpinner label="Saving changes…" size="sm" />
    ) : null;
  const notice = (
    <>
      {importError !== null && (
        <GlassAlert tone="warning" title="File not imported">
          <p>{importError}</p>
        </GlassAlert>
      )}
      {upload.notice}
      {editNotice}
    </>
  );

  const refreshButton = (
    <GlassButton
      ref={focusNewRefresh}
      onBlur={(event) => {
        // Moving to another control means the user has moved on; a removed button has no target.
        if (event.relatedTarget !== null) keepRefreshFocus.current = false;
      }}
      variant="soft"
      size="sm"
      aria-disabled={status.kind === 'reading' || saving || upload.uploading}
      onClick={(event) => {
        if (status.kind === 'reading' || saving || upload.uploading) return;
        keepRefreshFocus.current = document.activeElement === event.currentTarget;
        refresh();
      }}
    >
      {status.kind === 'disc' || status.kind === 'reading' ? 'Refresh' : status.action}
    </GlassButton>
  );

  const trackCount = status.kind === 'disc' ? status.raw.trackCount : 0;
  const titles =
    status.kind === 'disc'
      ? status.disc.groups
          .flatMap((group) => group.tracks)
          .sort((a, b) => a.number - b.number)
          .map((track) => (track.untitled ? '' : track.title))
      : [];
  // A failed read (in use, Hi-MD mode, not answering) makes any earlier status stale.
  const readable = result === 'reading' || pollable;
  const shownStatus = readable ? deviceStatus : null;
  const blocker = playerBlocker({
    status: shownStatus,
    reading: status.kind === 'reading',
    saving,
    readable,
    noDisc: result !== 'reading' && result.kind === 'no-disc',
  });
  /** Sends a playback control and shows the status or failure it leads to. */
  const runControl = (command: PlaybackCommand) => {
    setControlError(null);
    void reader
      .control(command, { track: deviceStatus?.track ?? null, trackCount })
      .then(({ outcome, status: next }) => {
        if (!mounted.current) return;
        if (next !== null) setDeviceStatus(next);
        if (outcome.kind === 'failed') setControlError(controlFailureMessage(outcome.reason));
      });
  };
  const player = (
    <PlayerBar
      view={playerView(shownStatus, titles)}
      blocker={blocker}
      error={controlError}
      onControl={runControl}
    />
  );

  const raw = status.kind === 'disc' ? status.raw : null;
  const availability = menuAvailability({
    discRead: raw !== null,
    writeProtected: raw?.writeProtected ?? false,
    busy: saving || upload.uploading || status.kind === 'reading',
  });
  /** Reads a chosen CSV and shows the review, or says why it cannot be used. */
  const startImport = (file: File) => {
    if (raw === null) return;
    setImportError(null);
    void file.text().then(
      (text) => {
        if (!mounted.current) return;
        const parsed = parseCsv(text);
        if ('error' in parsed) {
          setImportError(
            `“${file.name}” is not a title list mdconnect can read: it needs webminidisc's CSV columns.`,
          );
          return;
        }
        setMenuDialog({
          kind: 'import',
          fileName: file.name,
          parsed,
        });
      },
      () => {
        // The file was moved, deleted or could not be read; editState is left alone.
        if (mounted.current)
          setImportError(`“${file.name}” could not be read. Choose the file again.`);
      },
    );
  };
  const menu = menuSlot
    ? createPortal(
        <DiscMenu
          availability={availability}
          onExport={() => {
            if (raw !== null) downloadText(csvFileName(raw), formatCsv(raw));
          }}
          onImport={startImport}
          onWipe={() => {
            setMenuDialog({ kind: 'wipe' });
          }}
          onAbout={() => onAbout?.()}
          onExit={() => {
            void reader.close().then(() => onExit?.(device));
          }}
        />,
        menuSlot,
      )
    : null;
  // Reviewed against the disc shown now, which is what the import is applied to. While a change is
  // saving the disc is about to be read again, so the review waits for that read.
  const importReview =
    menuDialog?.kind === 'import' && raw !== null && !saving
      ? reviewImport(menuDialog.parsed, raw)
      : null;
  const dialogs = (
    <>
      {menuDialog?.kind === 'wipe' && raw !== null && (
        <WipeDialog
          returnFocus={() => menuTrigger(menuSlot)}
          discName={status.kind === 'disc' ? (status.disc.title ?? 'Untitled disc') : 'this disc'}
          onClose={() => {
            setMenuDialog(null);
          }}
          onConfirm={() => {
            setMenuDialog(null);
            runEdit(wipeDiscPlan());
          }}
        />
      )}
      {menuDialog?.kind === 'import' && raw !== null && importReview !== null && (
        <ImportDialog
          // A different review (the disc was read again) starts over, so a ticked mismatch never
          // carries over to another track.
          key={JSON.stringify(importReview)}
          returnFocus={() => menuTrigger(menuSlot)}
          fileName={menuDialog.fileName}
          review={importReview}
          onClose={() => {
            setMenuDialog(null);
          }}
          onConfirm={(skipped) => {
            setMenuDialog(null);
            runEdit(importPlan(menuDialog.parsed, raw, skipped));
          }}
        />
      )}
    </>
  );

  if (status.kind === 'disc') {
    return (
      <>
        {menu}
        {dialogs}
        {upload.dialogs}
        <DiscEditor
          upload={upload}
          player={player}
          deviceStatus={shownStatus}
          playBlocked={blocker !== null}
          onControl={runControl}
          disc={status.disc}
          raw={status.raw}
          busy={saving || upload.uploading}
          onEdit={runEdit}
          notice={notice}
          refresh={refreshButton}
        />
      </>
    );
  }
  return (
    <>
      {menu}
      <DiscAreas
        busy={status.kind === 'reading'}
        summary={
          <>
            <h2 className="text-lg font-semibold">Disc</h2>
            <div>{refreshButton}</div>
            {player}
          </>
        }
        tracks={
          status.kind === 'reading' ? (
            <GlassSpinner label={status.title} size="sm" />
          ) : (
            <GlassAlert tone={status.kind === 'notice' ? 'info' : 'warning'} title={status.title}>
              <p>{status.message}</p>
            </GlassAlert>
          )
        }
      />
    </>
  );
}
