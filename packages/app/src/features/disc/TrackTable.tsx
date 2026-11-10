import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import { PauseIcon, PlayIcon } from '@mdconnect/ui/components/glassyui/playback-icons';
import { useState } from 'react';

import { Action } from './Action';
import type { DiscView, GroupView, TrackView } from './disc-view';
import { moveDestination, type Selection } from './editing';

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
}: TrackTableProps & {
  readonly group: GroupView;
  readonly dropHint: DropHint;
  readonly onDropHint: (hint: DropHint) => void;
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
        />
      ))}
    </tbody>
  );
}

/** One track row, with its checkbox, drag handlers and drop indicator. */
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
}) {
  const index = track.number - 1;
  // Borders on the cells, not the row: rows draw no borders in the separated border model.
  const edge =
    hint === 'before'
      ? '[&>td]:border-t-indigo-600 dark:[&>td]:border-t-indigo-300'
      : hint === 'after'
        ? '[&>td]:border-b-indigo-600 dark:[&>td]:border-b-indigo-300'
        : '';
  return (
    <tr
      draggable={!locked}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(index));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => {
        if (locked) return;
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        onDropHint({ index, side: event.clientY < box.top + box.height / 2 ? 'before' : 'after' });
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
      <td className={`${CELL} hidden text-right text-xs opacity-80 sm:table-cell`}>{track.mode}</td>
    </tr>
  );
}
