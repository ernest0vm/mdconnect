import { App, bridgeRecordingFolders, type Platform } from '@mdconnect/app';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

const bridge = window.mdconnect;

const platform: Platform = {
  kind: 'desktop',
  os: bridge.os,
  usb: navigator.usb,
  deviceKinds: ['netmd', 'himd'],
  buildCommit: __MDCONNECT_COMMIT__,
  version: __MDCONNECT_VERSION__,
  deviceChooser: {
    onChooseDevice: (callback) => bridge.usb.onChooseDevice(callback),
    respond: (requestId, deviceId) => {
      bridge.usb.respondChooseDevice(requestId, deviceId);
    },
  },
  recordingFolders: bridgeRecordingFolders(bridge.recordings),
  recognition: {
    shazam: (signature) => bridge.recognition.shazam(signature),
  },
  appearance: {
    get: () => bridge.appearance.get(),
    onChange: (callback) => bridge.appearance.onChange(callback),
  },
};

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);
