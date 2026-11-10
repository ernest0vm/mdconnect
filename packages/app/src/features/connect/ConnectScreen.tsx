import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassPanel } from '@mdconnect/ui/components/glassyui/glass-panel';
import { GlassSpinner } from '@mdconnect/ui/components/glassyui/glass-spinner';
import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { Platform, UsbConnectionEventLike } from '../../platform';
import { PageShell } from '../../PageShell';
import { DiscPanel } from '../disc/DiscPanel';
import { ChooserDialog } from './ChooserDialog';
import { connectReducer, formatUsbId, initialConnectState } from './connect-state';
import { ConnectionController } from './connection-controller';
import { connectPrompt, guidanceFor, replugHint } from './guidance';

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
        const first = controller.firstOffered(devices);
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
    state.failure === null
      ? null
      : guidanceFor(state.failure, platform.os, {
          platformKind: platform.kind,
          deviceKinds: platform.deviceKinds,
        });

  const hint = replugHint(state, platform.kind);
  // The controller sets the open device before dispatching `connected`, so it is current here.
  const openDevice = state.device === null ? null : controller.openDevice();

  const alerts = (
    <>
      {hint && (
        <GlassAlert tone="info" title="Device unplugged">
          <p>{hint}</p>
        </GlassAlert>
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
    </>
  );
  const connectButton = (
    <div className="flex items-center gap-3">
      <GlassButton
        variant={state.device ? 'soft' : 'primary'}
        size={state.device ? 'sm' : 'md'}
        disabled={state.requesting}
        onClick={requestDevice}
      >
        {state.device ? 'Connect another device' : 'Connect device'}
      </GlassButton>
      {state.requesting && <GlassSpinner label="Connecting" size="sm" />}
    </div>
  );
  const chooser = platform.deviceChooser && (
    <ChooserDialog
      chooser={platform.deviceChooser}
      onCancel={() => {
        chooserCancelled.current = true;
      }}
    />
  );

  if (openDevice !== null && state.device) {
    return (
      <PageShell
        commit={platform.buildCommit}
        layout="app"
        header={
          <>
            <h1 className="text-base font-semibold">mdconnect</h1>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-base font-medium">{state.device.name}</span>
              <GlassBadge tone="green" className="shrink-0 font-mono">
                {formatUsbId(state.device.vendorId, state.device.productId)}
              </GlassBadge>
            </span>
            <span className="sm:ml-auto">{connectButton}</span>
          </>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-3 pb-2">
          {alerts}
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
            <DiscPanel key={deviceKey(openDevice)} device={openDevice} />
          </div>
        </div>
        {chooser}
      </PageShell>
    );
  }

  return (
    <PageShell commit={platform.buildCommit}>
      <GlassPanel className="flex w-full flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">Connect your MiniDisc</h1>
        {state.device ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-medium">{state.device.name}</span>
            <GlassBadge tone="green" className="font-mono">
              {formatUsbId(state.device.vendorId, state.device.productId)}
            </GlassBadge>
          </div>
        ) : (
          <p className="text-sm opacity-80">{connectPrompt(platform.deviceKinds)}</p>
        )}
        {alerts}
        {connectButton}
        {chooser}
      </GlassPanel>
    </PageShell>
  );
}

const deviceKeys = new WeakMap<object, string>();
let nextDeviceKey = 0;

/** A stable React key per device object, so a different device remounts the disc panel. */
function deviceKey(device: object): string {
  let key = deviceKeys.get(device);
  if (key === undefined) {
    nextDeviceKey += 1;
    key = `device-${String(nextDeviceKey)}`;
    deviceKeys.set(device, key);
  }
  return key;
}
