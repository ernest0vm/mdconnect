import { classifyUsbError, usbFilters } from '@mdconnect/core';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassPanel } from '@mdconnect/ui/components/glassyui/glass-panel';
import { GlassSpinner } from '@mdconnect/ui/components/glassyui/glass-spinner';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { Platform, UsbConnectionEventLike, UsbDeviceHandle } from '../../platform';
import { ChooserDialog } from './ChooserDialog';
import { connectReducer, describeDevice, formatUsbId, initialConnectState } from './connect-state';
import { guidanceFor } from './guidance';
import { switchDevice } from './switch-device';

export function ConnectScreen({ platform }: { readonly platform: Platform }) {
  const [state, dispatch] = useReducer(connectReducer, initialConnectState);
  const chooserCancelled = useRef(false);
  const isIdle = useRef(true);
  const openHandle = useRef<UsbDeviceHandle | null>(null);

  useEffect(() => {
    isIdle.current = state.status === 'idle' || state.status === 'failed';
  }, [state.status]);

  const openDevice = useCallback(async (handle: UsbDeviceHandle) => {
    const device = describeDevice(handle);
    if (device === undefined) {
      dispatch({ type: 'failed', failure: 'no-device' });
      return;
    }
    try {
      await switchDevice(openHandle.current, handle);
      openHandle.current = handle;
      dispatch({ type: 'connected', device });
    } catch (error) {
      dispatch({ type: 'failed', failure: classifyUsbError(error, 'open') });
    }
  }, []);

  const requestDevice = async () => {
    chooserCancelled.current = false;
    dispatch({ type: 'request-started' });
    let handle: UsbDeviceHandle;
    try {
      handle = await platform.usb.requestDevice({ filters: usbFilters() });
    } catch (error) {
      const chooserWasCancelled = chooserCancelled.current;
      dispatch({
        type: 'failed',
        failure: classifyUsbError(error, 'request', { chooserCancelled: chooserWasCancelled }),
      });
      return;
    }
    await openDevice(handle);
  };

  // Reconnect without prompting: devices the platform already granted, now and when plugged in.
  useEffect(() => {
    let active = true;
    const connectIfIdle = (handle: UsbDeviceHandle) => {
      if (active && isIdle.current && describeDevice(handle) !== undefined) {
        void openDevice(handle);
      }
    };
    platform.usb
      .getDevices()
      .then((devices) => {
        const [first] = devices.filter((d) => describeDevice(d) !== undefined);
        if (first !== undefined) connectIfIdle(first);
      })
      .catch(() => {
        // Reconnecting on launch is best-effort; the Connect button still works.
      });
    const onConnect = (event: UsbConnectionEventLike) => {
      connectIfIdle(event.device);
    };
    const onDisconnect = ({ device }: UsbConnectionEventLike) => {
      if (device === openHandle.current) openHandle.current = null;
      dispatch({
        type: 'device-disconnected',
        vendorId: device.vendorId,
        productId: device.productId,
        serialNumber: device.serialNumber ?? undefined,
      });
    };
    platform.usb.addEventListener('connect', onConnect);
    platform.usb.addEventListener('disconnect', onDisconnect);
    return () => {
      active = false;
      platform.usb.removeEventListener('connect', onConnect);
      platform.usb.removeEventListener('disconnect', onDisconnect);
    };
  }, [platform, openDevice]);

  const guidance = state.status === 'failed' ? guidanceFor(state.failure, platform.os) : null;

  return (
    <GlassPanel className="flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Connect your MiniDisc</h1>

      {state.status === 'connected' ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-medium">{state.device.name}</span>
          <GlassBadge tone="green" className="font-mono">
            {formatUsbId(state.device.vendorId, state.device.productId)}
          </GlassBadge>
        </div>
      ) : (
        <p className="text-sm opacity-80">
          Plug in a NetMD or Hi-MD device over USB, then connect to it.
        </p>
      )}

      {guidance && (
        <GlassAlert tone="warning" title={guidance.title}>
          <p>{guidance.message}</p>
          {guidance.link && (
            <a className="underline" href={guidance.link.href} target="_blank" rel="noreferrer">
              {guidance.link.label}
            </a>
          )}
        </GlassAlert>
      )}

      <div className="flex items-center gap-3">
        <GlassButton
          variant="primary"
          disabled={state.status === 'requesting'}
          onClick={() => {
            void requestDevice();
          }}
        >
          {state.status === 'connected' ? 'Connect another device' : 'Connect device'}
        </GlassButton>
        {state.status === 'requesting' && <GlassSpinner label="Connecting" size="sm" />}
      </div>

      {platform.deviceChooser && (
        <ChooserDialog
          chooser={platform.deviceChooser}
          onCancel={() => {
            chooserCancelled.current = true;
          }}
        />
      )}
    </GlassPanel>
  );
}
