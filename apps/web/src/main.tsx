import { App, UnsupportedBrowser } from '@mdconnect/app';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { isWebUsbSupported, webPlatform } from './platform';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

// Decide before any USB call: the unsupported path must never touch navigator.usb.
const supported = isWebUsbSupported({
  secureContext: window.isSecureContext,
  hasUsb: 'usb' in navigator,
});

/** The browser platform, or, in development with `?demo`, the platform with the demo device. */
async function platformForThisPage() {
  const platform = webPlatform(__MDCONNECT_COMMIT__);
  // `import.meta.env.DEV` is false in production builds, so the demo module is left out of them.
  if (import.meta.env.DEV) {
    const demo = await import('./demo-platform');
    if (demo.demoRequested(window.location.search)) {
      return demo.withDemoDevice(platform);
    }
  }
  return platform;
}

const app = supported ? (
  <App platform={await platformForThisPage()} />
) : (
  <UnsupportedBrowser commit={__MDCONNECT_COMMIT__} />
);

createRoot(root).render(<StrictMode>{app}</StrictMode>);
