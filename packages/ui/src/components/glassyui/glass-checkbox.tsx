'use client';

import clsx from 'clsx';
import { forwardRef, useEffect, useRef } from 'react';
import { mergeRefs } from './lib/merge-refs';

export interface GlassCheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Shows the mixed state, for example a "select all" box when only some rows are selected. */
  indeterminate?: boolean;
}

/** A native checkbox in the theme's accent colour, with a mixed state. */
export const GlassCheckbox = forwardRef<HTMLInputElement, GlassCheckboxProps>(
  function GlassCheckbox({ className, indeterminate = false, ...rest }, ref) {
    const local = useRef<HTMLInputElement>(null);
    useEffect(() => {
      // The mixed state exists only as a DOM property, not as an attribute.
      if (local.current) local.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
      <input
        ref={mergeRefs(local, ref)}
        type="checkbox"
        aria-checked={indeterminate ? 'mixed' : undefined}
        className={clsx(
          'size-4 shrink-0 cursor-pointer accent-indigo-600 dark:accent-indigo-300',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...rest}
      />
    );
  },
);
