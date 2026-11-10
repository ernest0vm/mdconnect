'use client';

import clsx from 'clsx';

export interface GlassMeterProps {
  /** Current value, from 0 to `max`. */
  readonly value: number;
  readonly max: number;
  /** What the bar measures, for assistive technology. */
  readonly label: string;
  /** The value as words, for example "30:00 used of 80:00". */
  readonly valueText: string;
  readonly className?: string;
}

/** A horizontal bar for a measured amount, such as the time recorded on a disc. */
export function GlassMeter({ value, max, label, valueText, className }: GlassMeterProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, 0), max)}
      aria-valuetext={valueText}
      className={clsx(
        'h-2.5 w-full overflow-hidden rounded-full bg-black/15 dark:bg-black/35',
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-indigo-700 dark:bg-indigo-300"
        style={{ width: `${String(ratio * 100)}%` }}
      />
    </div>
  );
}
