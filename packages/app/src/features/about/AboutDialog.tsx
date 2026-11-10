import { licenseName, sourceLink } from '@mdconnect/core';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';

import { buildLabel } from './about-view';

/** Credits and license: mdconnect is a port of webminidisc and uses a port of netmd-js. */
export function AboutDialog({
  commit,
  onClose,
  returnFocus,
}: {
  readonly commit: string;
  readonly onClose: () => void;
  /** Where focus goes when the dialog closes. */
  readonly returnFocus?: () => HTMLElement | null;
}) {
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Close" returnFocus={returnFocus}>
        <GlassDialogTitle className="text-lg font-semibold">About mdconnect</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          Manage the discs in Sony NetMD MiniDisc devices from your computer.
        </GlassDialogDescription>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <p className="font-mono">{buildLabel(commit)}</p>
          <p>
            mdconnect is free software under {licenseName}.{' '}
            <a className="underline" href={sourceLink(commit)} target="_blank" rel="noreferrer">
              Source code
            </a>
          </p>
          <p>
            A port of{' '}
            <a
              className="underline"
              href="https://github.com/asivery/webminidisc"
              target="_blank"
              rel="noreferrer"
            >
              webminidisc
            </a>{' '}
            by Stefano Brilli and Asivery, using a port of{' '}
            <a
              className="underline"
              href="https://github.com/cybercase/netmd-js"
              target="_blank"
              rel="noreferrer"
            >
              netmd-js
            </a>{' '}
            by the same authors, both under GPL-2.0.
          </p>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
