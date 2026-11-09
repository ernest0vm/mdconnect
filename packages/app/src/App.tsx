import { GlassProvider } from '@mdconnect/ui/components/glassyui/glass-provider';

import { AppearanceBridge } from './AppearanceBridge';
import { ConnectScreen } from './features/connect/ConnectScreen';
import type { Platform } from './platform';
import { SourceFooter } from './SourceFooter';

export function App({ platform }: { readonly platform: Platform }) {
  return (
    <GlassProvider>
      <AppearanceBridge appearance={platform.appearance} />
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-sky-200 via-indigo-200 to-rose-200 p-6 text-slate-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100">
        <div className="flex w-full max-w-md flex-col gap-4">
          <ConnectScreen platform={platform} />
          <SourceFooter commit={platform.buildCommit} />
        </div>
      </main>
    </GlassProvider>
  );
}
