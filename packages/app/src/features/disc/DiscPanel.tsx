import type { Disc } from '@mdconnect/netmd';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import { GlassSpinner } from '@mdconnect/ui/components/glassyui/glass-spinner';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import type { UsbDeviceHandle } from '../../platform';
import { DeleteDialog } from './DeleteDialog';
import { DiscReader, openNetMdSession, type DiscReadResult } from './disc-reader';
import { discStatus } from './disc-status';
import type { DiscView, GroupView } from './disc-view';
import {
  deleteTracksPlan,
  groupTracksPlan,
  moveTrackPlan,
  renameDiscPlan,
  renameGroupPlan,
  renameTrackPlan,
  ungroupPlan,
  type EditPlan,
} from './edit-plan';
import {
  editBlocker,
  editFailureMessage,
  groupBlocker,
  moveDestination,
  selectAllState,
  selectionLabel,
  toggleTrack,
  type Selection,
} from './editing';
import { isHiMdMode } from './hi-md-mode';
import { TitleDialog } from './TitleDialog';
import type { TitleForm } from './title-form';

type Dialog =
  | { readonly kind: 'rename-disc' }
  | { readonly kind: 'rename-track'; readonly index: number }
  | { readonly kind: 'new-group'; readonly tracks: readonly number[] }
  | { readonly kind: 'rename-group'; readonly track: number }
  | { readonly kind: 'delete'; readonly tracks: readonly number[] };

/** A button that stays focusable while unavailable, so keyboard focus is not lost mid-edit. */
function Action({
  label,
  blocked,
  describedBy,
  onRun,
}: {
  label: string;
  blocked: boolean;
  describedBy?: string | undefined;
  onRun: () => void;
}) {
  return (
    <GlassButton
      variant="soft"
      size="sm"
      aria-disabled={blocked}
      aria-describedby={blocked ? describedBy : undefined}
      onClick={() => {
        if (!blocked) onRun();
      }}
    >
      {label}
    </GlassButton>
  );
}

interface TrackListProps {
  readonly group: GroupView;
  readonly selection: Selection;
  readonly locked: boolean;
  readonly reasonId: string;
  readonly onToggle: (index: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onRenameGroup: (track: number) => void;
  readonly onUngroup: (track: number) => void;
}

function TrackList({
  group,
  selection,
  locked,
  reasonId,
  onToggle,
  onMove,
  onRenameGroup,
  onUngroup,
}: TrackListProps) {
  const [dropHint, setDropHint] = useState<{ index: number; side: 'before' | 'after' } | null>(
    null,
  );
  const firstTrack = (group.tracks[0]?.number ?? 1) - 1;
  return (
    <section className="flex flex-col gap-1">
      {group.title !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{group.title}</h3>
          <Action
            label="Rename group"
            blocked={locked}
            describedBy={reasonId}
            onRun={() => {
              onRenameGroup(firstTrack);
            }}
          />
          <Action
            label="Ungroup"
            blocked={locked}
            describedBy={reasonId}
            onRun={() => {
              onUngroup(firstTrack);
            }}
          />
        </div>
      )}
      <ol className="flex flex-col gap-1">
        {group.tracks.map((track) => {
          const index = track.number - 1;
          const hint = dropHint?.index === index ? dropHint.side : null;
          return (
            <li
              key={track.number}
              draggable={!locked}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', String(index));
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (locked) return;
                event.preventDefault();
                const box = event.currentTarget.getBoundingClientRect();
                const side = event.clientY < box.top + box.height / 2 ? 'before' : 'after';
                setDropHint({ index, side });
              }}
              onDragLeave={() => {
                setDropHint(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropHint(null);
                const from = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);
                if (Number.isNaN(from) || hint === null) return;
                onMove(from, moveDestination(from, index, hint));
              }}
              className={[
                'flex items-baseline gap-3 rounded text-sm',
                selection.has(index) ? 'bg-indigo-500/15' : '',
                hint === 'before' ? 'border-t-2 border-indigo-600 dark:border-indigo-300' : '',
                hint === 'after' ? 'border-b-2 border-indigo-600 dark:border-indigo-300' : '',
                locked ? '' : 'cursor-grab',
              ].join(' ')}
            >
              <GlassCheckbox
                className="self-center"
                aria-label={`Select track ${String(track.number)}`}
                checked={selection.has(index)}
                onChange={() => {
                  onToggle(index);
                }}
              />
              <span className="w-6 shrink-0 text-right font-mono tabular-nums opacity-80">
                {track.number}
              </span>
              <span className={track.untitled ? 'grow italic opacity-80' : 'grow'}>
                {track.title}
                {track.subtitle !== null && (
                  <span className="block text-xs opacity-80">{track.subtitle}</span>
                )}
              </span>
              <span className="font-mono text-xs tabular-nums">{track.duration}</span>
              <span className="w-14 shrink-0 text-right text-xs opacity-80">{track.mode}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface EditorProps {
  readonly disc: DiscView;
  readonly raw: Disc;
  readonly busy: boolean;
  readonly onEdit: (plan: EditPlan, selectAfter?: Selection) => void;
  readonly notice: ReactNode;
}

function DiscEditor({ disc, raw, busy, onEdit, notice }: EditorProps) {
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

  const edit = (plan: EditPlan, selectAfter?: Selection) => {
    setDialog(null);
    onEdit(plan, selectAfter);
    if (selectAfter) setSelection(selectAfter);
  };
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= raw.trackCount) return;
    edit(moveTrackPlan(raw, from, to), new Set([to]));
  };
  const saveTitles = (form: TitleForm, plan: (form: TitleForm) => EditPlan) => {
    edit(plan(form));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={disc.title === null ? 'text-lg italic' : 'text-lg font-semibold'}>
          {disc.title ?? 'Untitled disc'}
        </h2>
        {disc.writeProtected && <GlassBadge tone="orange">Write-protected</GlassBadge>}
        <Action
          label="Rename disc"
          blocked={locked}
          describedBy={reasonId}
          onRun={() => {
            setDialog({ kind: 'rename-disc' });
          }}
        />
      </div>
      {disc.subtitle !== null && <p className="-mt-2 text-sm opacity-80">{disc.subtitle}</p>}
      <p className="text-sm">
        {disc.capacity.used} used · {disc.capacity.free} free · {disc.capacity.total} total
      </p>

      {disc.groups.length === 0 ? (
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
              describedBy={grouping.kind === 'plan' ? reasonId : `${reasonId}-group`}
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
          {notice}
          <div
            className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1"
            // Scrollable regions must be reachable by keyboard.
            tabIndex={0}
            aria-label="Tracks"
          >
            {disc.groups.map((group, i) => (
              <TrackList
                key={`${String(i)}-${group.title ?? ''}`}
                group={group}
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
              />
            ))}
          </div>
        </>
      )}

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
            saveTitles(form, (f) =>
              renameDiscPlan(f.halfWidth, f.fullWidthChanged ? f.fullWidth : undefined),
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
            saveTitles(form, (f) =>
              renameTrackPlan(
                dialog.index,
                f.halfWidth,
                f.fullWidthChanged ? f.fullWidth : undefined,
              ),
            );
          }}
        />
      )}
      {dialog?.kind === 'new-group' && (
        <TitleDialog
          disc={raw}
          target={{ kind: 'new-group', tracks: dialog.tracks }}
          heading={`Group ${selectionLabel(new Set(dialog.tracks)).replace(' selected', '')}`}
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
            saveTitles(form, (f) =>
              renameGroupPlan(
                raw,
                dialog.track,
                f.halfWidth,
                f.fullWidthChanged ? f.fullWidth : undefined,
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
    </div>
  );
}

type EditState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly message: string };

/** Reads the disc in the open device, shows it, and edits it. */
export function DiscPanel({ device }: { readonly device: UsbDeviceHandle }) {
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
  const mounted = useRef(true);

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
      if (current) setResult(next);
    });
    return () => {
      current = false;
    };
  }, [reader, generation]);

  const refresh = useCallback(() => {
    setResult('reading');
    setEditState({ kind: 'idle' });
    setGeneration((n) => n + 1);
  }, []);

  const runEdit = useCallback(
    (plan: EditPlan) => {
      if (plan.commands.length === 0) return;
      setEditState({ kind: 'saving' });
      void reader.edit(plan).then(({ outcome, result: next }) => {
        if (!mounted.current) return;
        setResult(next);
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
  const notice =
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

  return (
    <div className="flex flex-col gap-3" aria-busy={status.kind === 'reading' || saving}>
      {status.kind === 'reading' && <GlassSpinner label={status.title} size="sm" />}
      {status.kind === 'disc' && (
        <DiscEditor
          disc={status.disc}
          raw={status.raw}
          busy={saving}
          onEdit={runEdit}
          notice={notice}
        />
      )}
      {(status.kind === 'notice' || status.kind === 'warning') && (
        <GlassAlert tone={status.kind === 'notice' ? 'info' : 'warning'} title={status.title}>
          <p>{status.message}</p>
        </GlassAlert>
      )}
      {/* The button stays mounted while reading, so keyboard focus is not lost on Refresh. */}
      <div>
        <GlassButton
          variant="soft"
          size="sm"
          aria-disabled={status.kind === 'reading' || saving}
          onClick={() => {
            if (status.kind !== 'reading' && !saving) refresh();
          }}
        >
          {status.kind === 'disc' || status.kind === 'reading' ? 'Refresh' : status.action}
        </GlassButton>
      </div>
    </div>
  );
}
