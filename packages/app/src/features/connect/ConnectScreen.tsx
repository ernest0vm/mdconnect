import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassPanel } from '@mdconnect/ui/components/glassyui/glass-panel';
import { GlassSpinner } from '@mdconnect/ui/components/glassyui/glass-spinner';
import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { Platform, UsbConnectionEventLike } from '../../platform';
import { ChooserDialog } from './ChooserDialog';
import { connectReducer, describeDevice, formatUsbId, initialConnectState } from './connect-state';
import { ConnectionController } from './connection-controller';
import { guidanceFor } from './guidance';

/**
 * The walking-skeleton screen: connect a MiniDisc device and show it, or explain why not.
 * Connection logic lives in ConnectionController; this component renders its state.
 */
export function ConnectScreen({ platform }: { readonly platform: Platform }) {
  const [state, dispatch] = useReducer(connectReducer, initialConnectState);
  const chooserCancelled = useRef(false);
  const controller = useMemo(
    () => new ConnectionController(platform.usb, platform.deviceKinds, dispatch),
    [platform.usb, platform.deviceKinds],
  );

  const requestDevice = () => {
    chooserCancelled.current = false;
    void controller.request(() => chooserCancelled.current);
  };

  // Reconnect without prompting: devices the platform already granted, now and when plugged in.
  useEffect(() => {
    let active = true;
    platform.usb
      .getDevices()
      .then((devices) => {
        const [first] = devices.filter((d) => describeDevice(d) !== undefined);
        if (active && first !== undefined) void controller.autoConnect(first);
      })
      .catch(() => {
        // Reconnecting on launch is best-effort; the Connect button still works.
      });
    const onConnect = ({ device }: UsbConnectionEventLike) => {
      if (active) void controller.autoConnect(device);
    };
    const onDisconnect = ({ device }: UsbConnectionEventLike) => {
      controller.handleDisconnect(device);
    };
    platform.usb.addEventListener('connect', onConnect);
    platform.usb.addEventListener('disconnect', onDisconnect);
    return () => {
      active = false;
      platform.usb.removeEventListener('connect', onConnect);
      platform.usb.removeEventListener('disconnect', onDisconnect);
    };
  }, [platform.usb, controller]);

  const guidance =
    state.failure === null ? null : guidanceFor(state.failure, platform.os, platform.kind);

  return (
    <GlassPanel className="flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Connect your MiniDisc</h1>

      {state.device ? (
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
        <GlassButton variant="primary" disabled={state.requesting} onClick={requestDevice}>
          {state.device ? 'Connect another device' : 'Connect device'}
        </GlassButton>
        {state.requesting && <GlassSpinner label="Connecting" size="sm" />}
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
