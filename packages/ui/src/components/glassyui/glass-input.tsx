'use client';

import clsx from 'clsx';
import { forwardRef } from 'react';

export type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** A text field on glass: a native input with a visible border and focus ring in both themes. */
export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { className, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={clsx(
        'w-full rounded-lg border px-3 py-1.5 text-sm',
        'border-black/30 bg-white/60 text-inherit placeholder:text-black/55',
        'dark:border-white/35 dark:bg-white/10 dark:placeholder:text-white/60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300',
        'aria-invalid:border-red-700 dark:aria-invalid:border-red-300',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
});
