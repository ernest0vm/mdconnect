import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { useEffect, useState } from 'react';

import type { ChooseDeviceRequest, DeviceChooserBridge } from '../../platform';
import { chooserView } from './chooser-view';

interface ChooserDialogProps {
  readonly chooser: DeviceChooserBridge;
  /** Called before a cancel is sent, so the failed request is classified as cancelled. */
  readonly onCancel: () => void;
}

/** In-app device chooser for the desktop app, where Electron shows no browser chooser. */
export function ChooserDialog({ chooser, onCancel }: ChooserDialogProps) {
  const [request, setRequest] = useState<ChooseDeviceRequest | null>(null);

  useEffect(() => chooser.onChooseDevice(setRequest), [chooser]);

  if (request === null) return null;
  const view = chooserView(request.devices);

  const answer = (deviceId: string | null) => {
    if (deviceId === null) onCancel();
    chooser.respond(request.requestId, deviceId);
    setRequest(null);
  };

  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open) answer(null);
      }}
    >
      <GlassDialogContent closeLabel="Cancel">
        <GlassDialogTitle className="text-lg font-semibold">Choose a device</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          Several MiniDisc devices are connected.
        </GlassDialogDescription>
        <ul className="mt-4 flex flex-col gap-2">
          {view.entries.map((entry) => (
            <li key={entry.deviceId}>
              <GlassButton
                variant="soft"
                className="w-full justify-between"
                onClick={() => {
                  answer(entry.deviceId);
                }}
              >
                <span>{entry.title}</span>
                <span className="font-mono text-xs opacity-80">{entry.detail}</span>
              </GlassButton>
            </li>
          ))}
        </ul>
        {view.showUnplugHint && (
          <p className="mt-3 text-sm opacity-80">
            Some devices look identical. To be sure, unplug the other device, then cancel and
            connect again.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <GlassButton
            variant="ghost"
            onClick={() => {
              answer(null);
            }}
          >
            Cancel
          </GlassButton>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
