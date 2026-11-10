import type { ReactNode } from 'react';

import { SettingsDialog } from './features/settings/SettingsDialog';
import { SourceFooter } from './SourceFooter';

const BACKDROP =
  'bg-gradient-to-br from-sky-200 via-indigo-200 to-rose-200 text-slate-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100';

export type PageLayout = 'centered' | 'app';

/**
 * Full-page backdrop shared by every top-level screen, with the GPL source footer and the
 * Settings control.
 *
 * - `centered`: one column of at most 28 rem in the middle of the page, for screens with little
 *   content (connecting, unsupported browser). The page scrolls if it has to.
 * - `app`: the whole window, with `header` on top, `children` filling the middle and the footer at
 *   the bottom. The page itself does not scroll; the middle hands its height to its content.
 */
export function PageShell({
  commit,
  layout = 'centered',
  header,
  children,
}: {
  readonly commit: string;
  readonly layout?: PageLayout;
  readonly header?: ReactNode;
  readonly children: ReactNode;
}) {
  if (layout === 'app') {
    return (
      <div className={`grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto] ${BACKDROP}`}>
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-2 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">{header}</div>
          <SettingsDialog />
        </header>
        <main className="min-h-0 overflow-y-auto px-4 sm:px-6">{children}</main>
        <footer className="px-4 py-2 sm:px-6">
          <SourceFooter commit={commit} />
        </footer>
      </div>
    );
  }
  return (
    <main className={`grid min-h-screen place-items-center p-6 ${BACKDROP}`}>
      <div className="flex w-full max-w-md flex-col gap-4">
        {children}
        <div className="flex items-center justify-between gap-3">
          <SourceFooter commit={commit} />
          <SettingsDialog />
        </div>
      </div>
    </main>
  );
}
