import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import {
  GlassContextMenu,
  GlassContextMenuContent,
  GlassContextMenuItem,
  GlassContextMenuTrigger,
} from '@mdconnect/ui/components/glassyui/glass-context-menu';
import { PauseIcon, PlayIcon } from '@mdconnect/ui/components/glassyui/playback-icons';
import { useRef, useState, type KeyboardEvent } from 'react';

import { Action } from './Action';
import type { DiscView, GroupView, TrackView } from './disc-view';
import { moveDestination, type Selection } from './editing';
import { trackAfterAction, type TrackAction } from './track-menu';

type DropHint = { readonly index: number; readonly side: 'before' | 'after' } | null;

export interface TrackTableProps {
  readonly disc: DiscView;
  readonly selection: Selection;
  readonly locked: boolean;
  /** Element that says why editing is unavailable. */
  readonly reasonId: string;
  readonly onToggle: (index: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onRenameGroup: (track: number) => void;
  readonly onUngroup: (track: number) => void;
  /** Whether a zero-based track is the one playing, the one paused, or neither. */
  readonly playState: (track: number) => 'playing' | 'paused' | 'none';
  readonly playBlocked: boolean;
  /** Plays a track, or pauses or resumes it when it is the current one. */
  readonly onPlay: (track: number) => void;
  /** The context menu items of a zero-based track. */
  readonly trackMenu: (track: number) => readonly TrackAction[];
  /** Called when a track's context menu opens, before an item is chosen. */
  readonly onMenuOpen: (track: number) => void;
  readonly onTrackAction: (track: number, action: TrackAction['id']) => void;
}

/** Moves focus to the row of another track, for the arrow keys on a focused row. */
function focusRow(from: HTMLElement, track: number): void {
  from
    .closest('table')
    ?.querySelector<HTMLElement>(`tr[data-track="${String(track)}"]`)
    ?.focus();
}

/** The row of a zero-based track, where a dialog opened from its context menu returns focus. */
export function trackRow(track: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`tr[data-track="${String(track)}"]`);
}

/** Column count, for the group rows that span the table. */
const COLUMNS = 6;

const CELL = 'px-2 py-1.5 align-middle';

/**
 * The tracks as a table: column headings that stay at the top of the scrolling area, and one
 * row group per disc group. Below `sm` the Mode column is hidden and the mode shows under the title.
 */
export function TrackTable(props: TrackTableProps) {
  const [dropHint, setDropHint] = useState<DropHint>(null);
  // Roving focus: one row is in the Tab order; the arrow keys move between rows.
  const [focused, setFocused] = useState(0);
  const trackCount = props.disc.groups.reduce((sum, group) => sum + group.tracks.length, 0);
  const tabStop = Math.min(focused, trackCount - 1);
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur-sm dark:bg-slate-900/85">
        <tr className="text-left text-xs font-semibold">
          <th scope="col" className={`${CELL} w-8`}>
            <span className="sr-only">Selected</span>
          </th>
          <th scope="col" className={`${CELL} w-10`}>
            <span className="sr-only">Play</span>
          </th>
          <th scope="col" className={`${CELL} w-10 text-right`}>
            #
          </th>
          <th scope="col" className={CELL}>
            Title
          </th>
          <th scope="col" className={`${CELL} w-16 text-right`}>
            Duration
          </th>
          <th scope="col" className={`${CELL} hidden w-24 text-right sm:table-cell`}>
            Mode
          </th>
        </tr>
      </thead>
      {props.disc.groups.map((group, i) => (
        <GroupRows
          key={`${String(i)}-${group.title ?? ''}`}
          {...props}
          group={group}
          dropHint={dropHint}
          onDropHint={setDropHint}
          tabStop={tabStop}
          onRowFocus={setFocused}
        />
      ))}
    </table>
  );
}

/** One group's rows: a header row with its title and actions, then its tracks. */
function GroupRows({
  group,
  selection,
  locked,
  reasonId,
  onToggle,
  onMove,
  onRenameGroup,
  onUngroup,
  playState,
  playBlocked,
  onPlay,
  dropHint,
  onDropHint,
  tabStop,
  onRowFocus,
  trackMenu,
  onMenuOpen,
  onTrackAction,
}: TrackTableProps & {
  readonly group: GroupView;
  readonly dropHint: DropHint;
  readonly onDropHint: (hint: DropHint) => void;
  readonly tabStop: number;
  readonly onRowFocus: (track: number) => void;
}) {
  const firstTrack = (group.tracks[0]?.number ?? 1) - 1;
  return (
    <tbody>
      {group.title !== null && (
        <tr>
          {/*
            The header cell holds only the group title, so that is all a screen reader repeats for
            the group's cells. It is visually hidden; the visible title sits with the buttons.
          */}
          <th scope="rowgroup" className="sr-only">
            {group.title}
          </th>
          <td
            colSpan={COLUMNS}
            className="border-t border-black/15 px-2 pt-3 pb-1 dark:border-white/20"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true" className="text-sm font-semibold [overflow-wrap:anywhere]">
                {group.title}
              </span>
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
          </td>
        </tr>
      )}
      {group.tracks.map((track) => (
        <TrackRow
          key={track.number}
          track={track}
          selected={selection.has(track.number - 1)}
          locked={locked}
          hint={dropHint?.index === track.number - 1 ? dropHint.side : null}
          playState={playState(track.number - 1)}
          playBlocked={playBlocked}
          onPlay={onPlay}
          onToggle={onToggle}
          onMove={onMove}
          onDropHint={onDropHint}
          tabStop={tabStop === track.number - 1}
          onFocus={onRowFocus}
          actions={trackMenu(track.number - 1)}
          onMenuOpen={onMenuOpen}
          onAction={onTrackAction}
        />
      ))}
    </tbody>
  );
}

/**
 * One track row, with its checkbox, drag handlers and drop indicator. The row opens the track's
 * context menu on right-click, or with the context-menu key or Shift+F10 when it has focus.
 */
function TrackRow({
  track,
  selected,
  locked,
  hint,
  playState,
  playBlocked,
  onPlay,
  onToggle,
  onMove,
  onDropHint,
  tabStop,
  onFocus,
  actions,
  onMenuOpen,
  onAction,
}: {
  readonly track: TrackView;
  readonly selected: boolean;
  readonly locked: boolean;
  readonly hint: 'before' | 'after' | null;
  readonly playState: 'playing' | 'paused' | 'none';
  readonly playBlocked: boolean;
  readonly onPlay: (track: number) => void;
  readonly onToggle: (index: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onDropHint: (hint: DropHint) => void;
  readonly tabStop: boolean;
  readonly onFocus: (track: number) => void;
  readonly actions: readonly TrackAction[];
  readonly onMenuOpen: (track: number) => void;
  readonly onAction: (track: number, action: TrackAction['id']) => void;
}) {
  const index = track.number - 1;
  const row = useRef<HTMLTableRowElement>(null);
  /** The track that gets focus when the menu closes: a moved track keeps it. */
  const focusAfter = useRef(index);
  /** When the keyboard last opened the menu, to ignore a native `contextmenu` that follows. */
  const keyboardOpenedAt = useRef(Number.NEGATIVE_INFINITY);
  /** Up and Down move to the next row; keys pressed on the row's own controls are theirs. */
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      // Browsers differ in whether these keys fire `contextmenu`; open the menu at the row.
      event.preventDefault();
      keyboardOpenedAt.current = event.timeStamp;
      const box = event.currentTarget.getBoundingClientRect();
      event.currentTarget.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: box.left + box.width / 3,
          clientY: box.bottom,
        }),
      );
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    focusRow(event.currentTarget, index + step);
  };
  // Borders on the cells, not the row: rows draw no borders in the separated border model.
  const edge =
    hint === 'before'
      ? '[&>td]:border-t-indigo-600 dark:[&>td]:border-t-indigo-300'
      : hint === 'after'
        ? '[&>td]:border-b-indigo-600 dark:[&>td]:border-b-indigo-300'
        : '';
  return (
    <GlassContextMenu
      onOpenChange={(open) => {
        if (!open) return;
        focusAfter.current = index;
        onMenuOpen(index);
      }}
    >
      <GlassContextMenuTrigger asChild>
        <tr
          ref={row}
          data-track={index}
          tabIndex={tabStop ? 0 : -1}
          aria-label={`Track ${String(track.number)}: ${track.title}`}
          onFocus={() => {
            onFocus(index);
          }}
          onKeyDown={onKeyDown}
          onContextMenu={(event) => {
            // Some platforms also fire their own event for the key (Windows on key up); the menu
            // is already open at the row, so it must not move.
            if (event.nativeEvent.isTrusted && event.timeStamp - keyboardOpenedAt.current < 1000) {
              event.preventDefault();
            }
          }}
          draggable={!locked}
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', String(index));
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(event) => {
            if (locked) return;
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            onDropHint({
              index,
              side: event.clientY < box.top + box.height / 2 ? 'before' : 'after',
            });
          }}
          onDragLeave={() => {
            onDropHint(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            onDropHint(null);
            const from = Number.parseInt(event.dataTransfer.getData('text/plain'), 10);
            if (Number.isNaN(from) || hint === null) return;
            onMove(from, moveDestination(from, index, hint));
          }}
          className={[
            '[&>td]:border-y-2 [&>td]:border-transparent',
            selected ? 'bg-indigo-500/15' : '',
            playState === 'none' ? '' : 'font-semibold',
            'outline-none focus-visible:[&>td]:bg-indigo-500/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300',
            locked ? '' : 'cursor-grab',
            edge,
          ].join(' ')}
        >
          <td className={CELL}>
            <GlassCheckbox
              aria-label={`Select track ${String(track.number)}`}
              checked={selected}
              onChange={() => {
                onToggle(index);
              }}
            />
          </td>
          <td className={CELL}>
            <GlassButton
              variant={playState === 'none' ? 'ghost' : 'soft'}
              size="sm"
              aria-label={
                playState === 'playing'
                  ? `Pause track ${String(track.number)}, playing`
                  : playState === 'paused'
                    ? `Resume track ${String(track.number)}, paused`
                    : `Play track ${String(track.number)}`
              }
              aria-disabled={playBlocked}
              onClick={() => {
                if (!playBlocked) onPlay(index);
              }}
            >
              {playState === 'playing' ? <PauseIcon /> : <PlayIcon />}
            </GlassButton>
          </td>
          <td className={`${CELL} text-right font-mono tabular-nums opacity-80`}>{track.number}</td>
          <td className={`${CELL} [overflow-wrap:anywhere]`}>
            <span className={track.untitled ? 'italic opacity-80' : undefined}>{track.title}</span>
            {track.subtitle !== null && (
              <span className="block text-xs opacity-80">{track.subtitle}</span>
            )}
            <span className="block text-xs opacity-80 sm:hidden">{track.mode}</span>
          </td>
          <td className={`${CELL} text-right font-mono text-xs tabular-nums`}>{track.duration}</td>
          <td className={`${CELL} hidden text-right text-xs opacity-80 sm:table-cell`}>
            {track.mode}
          </td>
        </tr>
      </GlassContextMenuTrigger>
      <GlassContextMenuContent
        aria-label={`Track ${String(track.number)}`}
        onCloseAutoFocus={(event) => {
          // Back to the row, also after a right-click, so the keyboard can go on from there.
          event.preventDefault();
          if (row.current !== null) focusRow(row.current, focusAfter.current);
        }}
      >
        {actions.map((action) => (
          <GlassContextMenuItem
            key={action.id}
            disabled={action.reason !== null}
            reason={action.reason}
            onSelect={() => {
              focusAfter.current = trackAfterAction(index, action.id);
              onAction(index, action.id);
            }}
          >
            {action.label}
          </GlassContextMenuItem>
        ))}
      </GlassContextMenuContent>
    </GlassContextMenu>
  );
}
