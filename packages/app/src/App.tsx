import { AppearanceRoot } from './AppearanceBridge';
import { WhatsNew } from './features/changelog/WhatsNew';
import { ConnectScreen } from './features/connect/ConnectScreen';
import { RecognitionPreferencesProvider } from './features/recognition/RecognitionPreferencesContext';
import { UploadPreferencesProvider } from './features/upload/UploadPreferencesContext';
import type { Platform } from './platform';

/**
 * The app's root: theme provider, appearance sync, stored preferences, the connect screen (which
 * picks its page layout) and "What's new".
 */
export function App({ platform }: { readonly platform: Platform }) {
  return (
    <AppearanceRoot appearance={platform.appearance}>
      <UploadPreferencesProvider>
        <RecognitionPreferencesProvider>
          <ConnectScreen platform={platform} />
        </RecognitionPreferencesProvider>
      </UploadPreferencesProvider>
      <WhatsNew version={platform.version} />
    </AppearanceRoot>
  );
}
