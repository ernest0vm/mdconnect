import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { GlassMeter } from '@mdconnect/ui/components/glassyui/glass-meter';

import { percentText } from '../../percent';

/** What the upload dialog shows. `finished` holds the closing summary once the upload is over. */
export interface UploadProgress {
  readonly total: number;
  /** Zero-based index of the track being transferred, or converted before the first transfer. */
  readonly index: number;
  readonly title: string;
  /** Conversion of the current or next track, from 0 to 1. */
  readonly converting: number;
  readonly writtenBytes: number;
  readonly totalBytes: number;
  readonly stopping: boolean;
  readonly finished: readonly string[] | null;
}

/**
 * Shows the upload while it runs. It cannot be dismissed then: closing it asks to cancel, which
 * stops after the track being transferred. Once the upload is over it shows the summary.
 */
export function UploadDialog({
  progress,
  onCancel,
  onClose,
}: {
  readonly progress: UploadProgress;
  readonly onCancel: () => void;
  readonly onClose: () => void;
}) {
  const { finished } = progress;
  const position = `Track ${String(progress.index + 1)} of ${String(progress.total)}`;
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (open) return;
        if (finished === null) onCancel();
        else onClose();
      }}
    >
      <GlassDialogContent
        closeLabel={finished === null ? 'Cancel upload' : 'Close'}
        onInteractOutside={(event) => {
          // A stray click outside must not cancel an upload.
          event.preventDefault();
        }}
      >
        <GlassDialogTitle className="text-lg font-semibold">
          {finished === null ? 'Uploading' : 'Upload finished'}
        </GlassDialogTitle>
        {finished === null ? (
          <>
            <GlassDialogDescription className="mt-1 text-sm">
              {position}: “{progress.title || 'Untitled'}”. Keep the device connected.
            </GlassDialogDescription>
            <div className="mt-4 flex flex-col gap-3" aria-live="polite">
              <div className="flex flex-col gap-1">
                <p className="text-sm">Converting {percentText(progress.converting, 1)}</p>
                <GlassMeter
                  label="Conversion"
                  value={progress.converting}
                  max={1}
                  valueText={percentText(progress.converting, 1)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm">
                  Writing to the disc {percentText(progress.writtenBytes, progress.totalBytes)}
                </p>
                <GlassMeter
                  label="Writing to the disc"
                  value={progress.writtenBytes}
                  max={Math.max(progress.totalBytes, 1)}
                  valueText={percentText(progress.writtenBytes, progress.totalBytes)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                aria-disabled={progress.stopping}
                onClick={() => {
                  if (!progress.stopping) onCancel();
                }}
              >
                {progress.stopping ? 'Stopping after the current track…' : 'Cancel'}
              </GlassButton>
            </div>
          </>
        ) : (
          <>
            <GlassDialogDescription className="mt-1 text-sm">{finished[0]}</GlassDialogDescription>
            {finished.length > 1 && (
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
                {finished.slice(1).map((line, index) => (
                  // Lines can repeat (two files with the same title skipped alike).
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs opacity-80">
              The device writes the new tracks to the disc when it stops or the disc is ejected.
            </p>
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
