import { sourceRepositoryUrl } from '@mdconnect/core';
import { GlassPanel } from '@mdconnect/ui/components/glassyui/glass-panel';

import { AppearanceRoot } from './AppearanceBridge';
import { PageShell } from './PageShell';

const SUPPORTED_BROWSERS = [
  'Google Chrome',
  'Microsoft Edge',
  'Opera',
  'other Chromium-based browsers',
];

/**
 * Shown instead of the app when WebUSB is unavailable (Firefox, Safari, or an insecure context).
 * It never touches `navigator.usb`.
 */
export function UnsupportedBrowser({ commit }: { readonly commit: string }) {
  return (
    <AppearanceRoot>
      <PageShell commit={commit}>
        <GlassPanel className="flex flex-col gap-4 p-6">
          <h1 className="text-xl font-semibold">This browser cannot reach USB devices</h1>
          <p className="text-sm opacity-80">
            mdconnect talks to MiniDisc devices over WebUSB, which this browser does not provide.
            Open this page over HTTPS in one of these browsers, on a computer or an Android device
            (browsers on iPhone and iPad do not provide WebUSB):
          </p>
          <ul className="list-inside list-disc text-sm">
            {SUPPORTED_BROWSERS.map((browser) => (
              <li key={browser}>{browser}</li>
            ))}
          </ul>
          <p className="text-sm">
            Or use the{' '}
            <a
              className="underline"
              href={`${sourceRepositoryUrl}#download`}
              target="_blank"
              rel="noreferrer"
            >
              desktop app
            </a>
            .
          </p>
        </GlassPanel>
      </PageShell>
    </AppearanceRoot>
  );
}
