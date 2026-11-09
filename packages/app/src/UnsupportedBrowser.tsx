import { sourceRepositoryUrl } from '@mdconnect/core';
import { GlassProvider } from '@mdconnect/ui/components/glassyui/glass-provider';
import { GlassPanel } from '@mdconnect/ui/components/glassyui/glass-panel';

import { ColorSchemeSync } from './AppearanceBridge';
import { SourceFooter } from './SourceFooter';

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
    <GlassProvider>
      <ColorSchemeSync />
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-sky-200 via-indigo-200 to-rose-200 p-6 text-slate-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 dark:text-slate-100">
        <div className="flex w-full max-w-md flex-col gap-4">
          <GlassPanel className="flex flex-col gap-4 p-6">
            <h1 className="text-xl font-semibold">This browser cannot reach USB devices</h1>
            <p className="text-sm opacity-80">
              mdconnect talks to MiniDisc devices over WebUSB, which this browser does not provide.
              Open this page over HTTPS in one of these browsers:
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
          <SourceFooter commit={commit} />
        </div>
      </main>
    </GlassProvider>
  );
}
