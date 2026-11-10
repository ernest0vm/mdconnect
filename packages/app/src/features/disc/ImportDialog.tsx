import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { useState } from 'react';

import type { ImportReview } from './csv';
import { trackCountLabel } from './editing';
import { ignoredTracksNote } from './menu-view';

/**
 * Shows what an import would change before anything is written: a different track count, and
 * tracks that do not match the file. Mismatched tracks are skipped unless the user ticks them.
 */
export function ImportDialog({
  fileName,
  review,
  onConfirm,
  onClose,
  returnFocus,
}: {
  readonly fileName: string;
  readonly review: ImportReview;
  /** Called with the 1-based tracks to leave as they are. */
  readonly onConfirm: (skipped: ReadonlySet<number>) => void;
  readonly onClose: () => void;
  /** Where focus goes when the dialog closes. */
  readonly returnFocus?: () => HTMLElement | null;
}) {
  const [labelled, setLabelled] = useState<ReadonlySet<number>>(new Set());
  const skipped = new Set(review.mismatches.map((m) => m.track).filter((t) => !labelled.has(t)));
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Cancel" returnFocus={returnFocus}>
        <GlassDialogTitle className="text-lg font-semibold">Import titles</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          From “{fileName}”. Nothing is written until you import.
        </GlassDialogDescription>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          {review.fileTracks !== review.discTracks && (
            <p>
              The file describes {trackCountLabel(review.fileTracks)}; the disc has{' '}
              {trackCountLabel(review.discTracks)}.
              {review.outside.length > 0 && ` ${ignoredTracksNote(review.outside)}`}
            </p>
          )}
          {review.mismatches.length === 0 ? (
            <p>Every track in the file matches the disc.</p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">
                These tracks do not match. Tick the ones to label anyway.
              </legend>
              {review.mismatches.map((m) => (
                <label key={m.track} className="flex items-start gap-2">
                  <GlassCheckbox
                    className="mt-0.5"
                    checked={labelled.has(m.track)}
                    onChange={() => {
                      setLabelled((current) => {
                        const next = new Set(current);
                        if (next.has(m.track)) next.delete(m.track);
                        else next.add(m.track);
                        return next;
                      });
                    }}
                  />
                  <span>
                    Track {m.track}: the file says {m.file}, the disc has {m.disc}.
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onConfirm(skipped);
              }}
            >
              Import titles
            </GlassButton>
          </div>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
