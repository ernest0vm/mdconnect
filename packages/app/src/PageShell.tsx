import type { ReactNode } from 'react';

import { SourceFooter } from './SourceFooter';

/** Full-page backdrop shared by every top-level screen, with the GPL source footer below. */
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
        <SourceFooter commit={commit} />
      </div>
    </main>
  );
}
