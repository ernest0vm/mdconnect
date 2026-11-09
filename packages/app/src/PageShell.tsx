import type { ReactNode } from 'react';

import { AppearanceDialog } from './features/appearance/AppearanceDialog';
import { SourceFooter } from './SourceFooter';

/**
 * Full-page backdrop shared by every top-level screen, with the GPL source footer and the
 * Appearance control below.
 */
export function PageShell({
  commit,
  children,
}: {
  readonly commit: string;
  readonly children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-sky-200 via-indigo-200 to-rose-200 p-6 text-slate-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100">
      <div className="flex w-full max-w-md flex-col gap-4">
        {children}
        <div className="flex items-center justify-between gap-3">
          <SourceFooter commit={commit} />
          <AppearanceDialog />
        </div>
      </div>
    </main>
  );
}
