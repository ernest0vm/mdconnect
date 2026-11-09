import { GlassProvider } from '@mdconnect/ui/components/glassyui/glass-provider';

import { AppearanceBridge } from './AppearanceBridge';
import { ConnectScreen } from './features/connect/ConnectScreen';
import { PageShell } from './PageShell';
import type { Platform } from './platform';

/** The app's root: theme provider, appearance sync and the connect screen on the shared page shell. */
export function App({ platform }: { readonly platform: Platform }) {
  return (
    <GlassProvider>
      <AppearanceBridge appearance={platform.appearance} />
      <PageShell commit={platform.buildCommit}>
        <ConnectScreen platform={platform} />
      </PageShell>
    </GlassProvider>
  );
}
