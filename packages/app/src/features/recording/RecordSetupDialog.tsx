import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { useState } from 'react';

import { AudioInputField } from './AudioInputField';
import type { LiveCapture } from './capture-source';
import { FOLDER_PROBLEM, longTrackWarning } from './record-view';
import type { RecordingTrack } from './session';
import { useLiveInput } from './useLiveInput';

/**
 * Explains the cabling, lets the user pick the audio input and watch its level, and hands the
 * open capture to the recording when the user starts it.
 */
export function RecordSetupDialog({
  tracks,
  onStart,
  onClose,
  returnFocus,
}: {
  readonly tracks: readonly RecordingTrack[];
  /** Called with the open capture; it then belongs to the recording. */
  readonly onStart: (capture: LiveCapture) => Promise<boolean>;
  readonly onClose: () => void;
  /** Where focus goes when the dialog closes: the control that opened it. */
  readonly returnFocus?: () => HTMLElement | null;
}) {
  const live = useLiveInput();
  const [starting, setStarting] = useState(false);
  const { capture } = live;

  const warning = longTrackWarning(tracks);
  const count = tracks.length;
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open && !starting) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Cancel" className="max-w-xl" returnFocus={returnFocus}>
        <GlassDialogTitle className="text-lg font-semibold">
          Record {count === 1 ? 'track' : `${String(count)} tracks`}
        </GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          The deck plays each track while mdconnect records it, so this takes as long as the tracks
          last.
        </GlassDialogDescription>
        <ol className="mt-4 flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>Connect the deck’s line-out or headphone output to the computer’s audio input.</li>
          <li>Choose that input below.</li>
          <li>
            Play a track on the deck and set its volume and the input gain so the level stays below
            full.
          </li>
        </ol>
        <div className="mt-4 flex flex-col gap-3">
          {/* Changing the input during a start would open a capture nobody closes. */}
          <AudioInputField live={live} locked={starting} />
          {warning !== null && <p className="text-sm">{warning}</p>}
          <div className="flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={starting}
              onClick={onClose}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="sm"
              disabled={capture === null || starting}
              onClick={() => {
                if (capture === null) return;
                setStarting(true);
                live.handOver();
                const keepSetup = () => {
                  live.takeBack();
                  setStarting(false);
                };
                onStart(capture).then(
                  (started) => {
                    // A cancelled folder picker leaves the setup open with the input still live.
                    if (!started) keepSetup();
                  },
                  (error: unknown) => {
                    console.error('mdconnect: the recording could not start', error);
                    keepSetup();
                    live.report(FOLDER_PROBLEM);
                  },
                );
              }}
            >
              Start recording
            </GlassButton>
          </div>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
