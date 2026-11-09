import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassSpinner } from '@mdconnect/ui/components/glassyui/glass-spinner';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { UsbDeviceHandle } from '../../platform';
import { DiscReader, openNetMdSession, type DiscReadResult } from './disc-reader';
import { discStatus } from './disc-status';
import { isHiMdMode } from './hi-md-mode';
import type { DiscView, GroupView } from './disc-view';

function TrackList({ group }: { readonly group: GroupView }) {
  return (
    <section className="flex flex-col gap-1">
      {group.title !== null && <h3 className="text-sm font-semibold">{group.title}</h3>}
      <ol className="flex flex-col gap-1">
        {group.tracks.map((track) => (
          <li key={track.number} className="flex items-baseline gap-3 text-sm">
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
        ))}
      </ol>
    </section>
  );
}

function DiscContents({ disc }: { readonly disc: DiscView }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={disc.title === null ? 'text-lg italic' : 'text-lg font-semibold'}>
          {disc.title ?? 'Untitled disc'}
        </h2>
        {disc.writeProtected && <GlassBadge tone="orange">Write-protected</GlassBadge>}
      </div>
      {disc.subtitle !== null && <p className="-mt-2 text-sm opacity-80">{disc.subtitle}</p>}
      <p className="text-sm">
        {disc.capacity.used} used · {disc.capacity.free} free · {disc.capacity.total} total
      </p>
      {disc.groups.length === 0 ? (
        <p className="text-sm opacity-80">This disc is blank.</p>
      ) : (
        <div
          className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1"
          // Scrollable regions must be reachable by keyboard.
          tabIndex={0}
          aria-label="Tracks"
        >
          {disc.groups.map((group, i) => (
            <TrackList key={`${String(i)}-${group.title ?? ''}`} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Reads the disc in the open device and shows it, with Refresh and the empty and error states. */
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

  useEffect(() => {
    let current = true;
    void reader.read().then((next) => {
      // After an unplug the panel is gone; a late result must not show anything.
      if (current) setResult(next);
    });
    return () => {
      current = false;
    };
  }, [reader, generation]);

  const refresh = useCallback(() => {
    setResult('reading');
    setGeneration((n) => n + 1);
  }, []);

  const status = discStatus(result);

  return (
    <div className="flex flex-col gap-3" aria-busy={status.kind === 'reading'}>
      {status.kind === 'reading' && <GlassSpinner label={status.title} size="sm" />}
      {status.kind === 'disc' && <DiscContents disc={status.disc} />}
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
          aria-disabled={status.kind === 'reading'}
          onClick={() => {
            if (status.kind !== 'reading') refresh();
          }}
        >
          {status.kind === 'disc' || status.kind === 'reading' ? 'Refresh' : status.action}
        </GlassButton>
      </div>
    </div>
  );
}
