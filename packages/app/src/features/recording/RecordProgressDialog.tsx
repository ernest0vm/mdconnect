import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { GlassMeter } from '@mdconnect/ui/components/glassyui/glass-meter';

import { percentText } from '../../percent';
import { progressLabel, summaryLines } from './record-view';
import type { RecordingProgress, RecordingSummary } from './session';

/**
 * Shows the recording while it runs, with Cancel; it cannot be dismissed by accident. Once the
 * recording has ended it shows the summary.
 */
export function RecordProgressDialog({
  progress,
  level,
  summary,
  stopping,
  onCancel,
  onClose,
  returnFocus,
}: {
  readonly progress: RecordingProgress | null;
  readonly level: number;
  readonly summary: RecordingSummary | null;
  readonly stopping: boolean;
  readonly onCancel: () => void;
  readonly onClose: () => void;
  /** Where focus goes when the dialog closes: the control that opened the recording. */
  readonly returnFocus?: () => HTMLElement | null;
}) {
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (open) return;
        if (summary === null) onCancel();
        else onClose();
      }}
    >
      <GlassDialogContent
        closeLabel={summary === null ? 'Cancel recording' : 'Close'}
        returnFocus={returnFocus}
        onInteractOutside={(event) => {
          // A stray click outside must not cancel a recording.
          event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          // Focus the status, not Cancel: a stray Space or Enter must not end a long recording.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)
            ?.querySelector<HTMLElement>('[data-autofocus]')
            ?.focus();
        }}
      >
        <GlassDialogTitle className="text-lg font-semibold">
          {summary === null ? 'Recording' : 'Recording finished'}
        </GlassDialogTitle>
        {summary === null ? (
          <>
            <GlassDialogDescription
              className="mt-1 text-sm outline-none"
              tabIndex={-1}
              data-autofocus
            >
              {progress === null ? 'Starting the deck' : progressLabel(progress)}. Keep the deck
              connected and playing.
            </GlassDialogDescription>
            <div className="mt-4 flex flex-col gap-3" aria-live="polite">
              <div className="flex flex-col gap-1">
                <p className="text-sm">Recorded {percentText(progress?.share ?? 0)}</p>
                <GlassMeter
                  label="Track recorded"
                  value={progress?.share ?? 0}
                  max={1}
                  valueText={percentText(progress?.share ?? 0)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm">Input level</p>
                <GlassMeter
                  label="Input level"
                  value={level}
                  max={1}
                  valueText={percentText(level)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                aria-disabled={stopping}
                onClick={() => {
                  if (!stopping) onCancel();
                }}
              >
                {stopping ? 'Stopping…' : 'Cancel'}
              </GlassButton>
            </div>
          </>
        ) : (
          <>
            {summaryLines(summary).map((line, index) => (
              <p key={index} className="mt-2 text-sm">
                {line}
              </p>
            ))}
            <div className="mt-4 flex justify-end">
              <GlassButton type="button" variant="primary" size="sm" onClick={onClose}>
                Done
              </GlassButton>
            </div>
          </>
        )}
      </GlassDialogContent>
    </GlassDialog>
  );
}
