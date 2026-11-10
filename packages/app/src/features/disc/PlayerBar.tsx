import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  StopIcon,
} from '@mdconnect/ui/components/glassyui/playback-icons';
import { useId, type ReactNode } from 'react';

import type { PlaybackCommand } from './disc-reader';
import type { PlayerView } from './player-view';

/** One player control: an icon with a text label for assistive technology. */
function Control({
  label,
  icon,
  blocked,
  reasonId,
  onRun,
}: {
  label: string;
  icon: ReactNode;
  blocked: boolean;
  reasonId: string;
  onRun: () => void;
}) {
  return (
    <GlassButton
      variant="soft"
      size="sm"
      aria-label={label}
      title={label}
      aria-disabled={blocked}
      aria-describedby={blocked ? reasonId : undefined}
      onClick={() => {
        if (!blocked) onRun();
      }}
    >
      {icon}
    </GlassButton>
  );
}

export interface PlayerBarProps {
  readonly view: PlayerView;
  /** Why the controls are unavailable, or null. */
  readonly blocker: string | null;
  /** A failed control, in words, or null. */
  readonly error: string | null;
  readonly onControl: (command: PlaybackCommand) => void;
}

/** Previous, Play or Pause, Stop and Next, with what the device is playing. */
export function PlayerBar({ view, blocker, error, onControl }: PlayerBarProps) {
  const reasonId = useId();
  const blocked = blocker !== null;
  return (
    <section aria-label="Player" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Control
          label="Previous track"
          icon={<PreviousIcon />}
          blocked={blocked}
          reasonId={reasonId}
          onRun={() => {
            onControl({ kind: 'previous' });
          }}
        />
        <Control
          label={view.playing ? 'Pause' : 'Play'}
          icon={view.playing ? <PauseIcon /> : <PlayIcon />}
          blocked={blocked}
          reasonId={reasonId}
          onRun={() => {
            onControl({ kind: view.playing ? 'pause' : 'play' });
          }}
        />
        <Control
          label="Stop"
          icon={<StopIcon />}
          blocked={blocked}
          reasonId={reasonId}
          onRun={() => {
            onControl({ kind: 'stop' });
          }}
        />
        <Control
          label="Next track"
          icon={<NextIcon />}
          blocked={blocked}
          reasonId={reasonId}
          onRun={() => {
            onControl({ kind: 'next' });
          }}
        />
      </div>
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
        {view.track !== null && <span className="font-mono tabular-nums">{view.track}</span>}
        {view.title !== null && (
          <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{view.title}</span>
        )}
        {view.time !== null && <span className="font-mono tabular-nums">{view.time}</span>}
        <span className="text-xs opacity-80">{view.state}</span>
      </p>
      {/* Announces a new track or state, not every second of the running time. */}
      <p className="sr-only" aria-live="polite">
        {view.announcement}
      </p>
      {blocked && (
        <p id={reasonId} className="text-xs opacity-80">
          {blocker}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-xs font-semibold">
          {error}
        </p>
      )}
    </section>
  );
}
