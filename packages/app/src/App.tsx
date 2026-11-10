import { AppearanceRoot } from './AppearanceBridge';
import { WhatsNew } from './features/changelog/WhatsNew';
import { ConnectScreen } from './features/connect/ConnectScreen';
import type { Platform } from './platform';

/** The app's root: theme provider, appearance sync, the connect screen (which picks its page layout) and "What's new". */
export function App({ platform }: { readonly platform: Platform }) {
  return (
    <AppearanceRoot appearance={platform.appearance}>
      <ConnectScreen platform={platform} />
      <WhatsNew version={platform.version} />
    </AppearanceRoot>
  );
}
