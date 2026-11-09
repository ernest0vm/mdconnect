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

createRoot(root).render(
  <StrictMode>
    {supported ? (
      <App platform={webPlatform(__MDCONNECT_COMMIT__)} />
    ) : (
      <UnsupportedBrowser commit={__MDCONNECT_COMMIT__} />
    )}
  </StrictMode>,
);
