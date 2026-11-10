import { AppearanceRoot } from './AppearanceBridge';
import { ConnectScreen } from './features/connect/ConnectScreen';
import { UploadPreferencesProvider } from './features/upload/UploadPreferencesContext';
import type { Platform } from './platform';

/** The app's root: theme provider, appearance sync, stored preferences and the connect screen, which picks its page layout. */
export function App({ platform }: { readonly platform: Platform }) {
  return (
    <AppearanceRoot appearance={platform.appearance}>
      <UploadPreferencesProvider>
        <ConnectScreen platform={platform} />
      </UploadPreferencesProvider>
    </AppearanceRoot>
  );
}
