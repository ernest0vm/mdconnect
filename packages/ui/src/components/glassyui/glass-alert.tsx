'use client';

import clsx from 'clsx';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode, TransitionEvent } from 'react';
import { useOptionalPreferences } from './glass-provider';

export type GlassAlertTone = 'info' | 'success' | 'warning' | 'danger';

export type GlassAlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  /** Names the close button. Defaults to "Dismiss". */
  dismissLabel?: string;
  /** Replaces the tone's icon. Pass `false` for none. */
  icon?: ReactNode | false;
  /**
   * Shows a close button. The alert folds away, then this runs: remove the alert here, and give
   * each alert a stable `key` so a later one never inherits the fold.
   */
  onDismiss?: () => void;
  title?: ReactNode;
  tone?: GlassAlertTone;
};

const ICON_PATHS: Record<GlassAlertTone, string[]> = {
  info: ['M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M10 9.2v4.1', 'M10 6.7h.01'],
  success: ['M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M6.9 10.2l2.2 2.2 4-4.4'],
  warning: ['M10 3.6 17 16H3L10 3.6Z', 'M10 8.4v3.4', 'M10 14h.01'],
  danger: ['M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M7.6 7.6l4.8 4.8', 'M12.4 7.6l-4.8 4.8'],
};

function ToneIcon({ tone }: { tone: GlassAlertTone }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20">
      {ICON_PATHS[tone].map((path) => (
        <path
          d={path}
          fill="none"
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      ))}
    </svg>
  );
}

// How long an alert takes to fold away. The stylesheet's transition matches it.
const FOLD_MS = 240;

/**
 * A short message set in tinted glass. Warnings and errors interrupt screen readers; the other
 * tones wait their turn. Override with `role`.
 */
export const GlassAlert = forwardRef<HTMLDivElement, GlassAlertProps>(
  (
    {
      children,
      className,
      dismissLabel = 'Dismiss',
      icon,
      onDismiss,
      role,
      title,
      tone = 'info',
      ...props
    },
    forwardedRef,
  ) => {
    const { preferences } = useOptionalPreferences();
    const [folding, setFolding] = useState(false);

    // The fold ends in the handler the caller has now, not the one they had at the click, and it
    // ends once.
    const dismissed = useRef(onDismiss);
    const finished = useRef(false);

    useEffect(() => {
      dismissed.current = onDismiss;
    }, [onDismiss]);

    const finish = useCallback(() => {
      if (finished.current) return;

      finished.current = true;
      dismissed.current?.();
    }, []);

    // A hidden tab runs no transitions, and the alert must still go. Unmounting cancels it, so a
    // caller who removed the alert first is not told about it afterwards.
    useEffect(() => {
      if (!folding) return;

      const timer = window.setTimeout(finish, FOLD_MS + 120);

      return () => {
        window.clearTimeout(timer);
      };
    }, [finish, folding]);

    const dismiss = () => {
      if (folding) return;

      if (
        preferences.reduceMotion ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        onDismiss?.();

        return;
      }

      setFolding(true);
    };

    // The alert sits in a row that shrinks to nothing, so what is below it slides up instead of
    // jumping, and its own padding and margin go with it.
    const folded = (event: TransitionEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') {
        finish();
      }
    };

    return (
      <div
        className="lg-alert-fold"
        data-state={folding ? 'folding' : undefined}
        onTransitionEnd={folded}
      >
        <div className="lg-alert-fold-inner">
          <div
            {...props}
            ref={forwardedRef}
            className={clsx('lg-alert', className)}
            data-tone={tone}
            role={role ?? (tone === 'warning' || tone === 'danger' ? 'alert' : 'status')}
          >
            {icon === false ? null : (
              <span aria-hidden className="lg-alert-icon">
                {icon ?? <ToneIcon tone={tone} />}
              </span>
            )}
            <div className="lg-alert-body">
              {title ? <p className="lg-alert-title">{title}</p> : null}
              {children ? <div className="lg-alert-description">{children}</div> : null}
            </div>
            {onDismiss ? (
              <button
                aria-label={dismissLabel}
                className="lg-alert-close"
                onClick={dismiss}
                type="button"
              >
                <svg aria-hidden viewBox="0 0 20 20">
                  <path
                    d="M5.5 5.5l9 9m0-9l-9 9"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);

GlassAlert.displayName = 'GlassAlert';
