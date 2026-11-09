import clsx from 'clsx';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export type GlassSpinnerSize = 'sm' | 'md' | 'lg';

export type GlassSpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Read out by screen readers. Defaults to "Loading". */
  label?: string;
  size?: GlassSpinnerSize;
};

/** A ring with a fading tail, for waiting on something short. It takes its colour from the text. */
export const GlassSpinner = forwardRef<HTMLSpanElement, GlassSpinnerProps>(
  ({ className, label = 'Loading', size = 'md', ...props }, forwardedRef) => (
    <span
      role="status"
      {...props}
      ref={forwardedRef}
      className={clsx('lg-spinner', className)}
      data-size={size}
    >
      <span aria-hidden className="lg-spinner-ring" />
      <span className="lg-visually-hidden">{label}</span>
    </span>
  ),
);

GlassSpinner.displayName = 'GlassSpinner';
