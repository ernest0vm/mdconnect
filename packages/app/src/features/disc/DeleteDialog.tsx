import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';

/** Asks before erasing tracks: erased audio cannot be recovered. */
export function DeleteDialog({
  count,
  onConfirm,
  onClose,
}: {
  readonly count: number;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  const tracks = `${String(count)} ${count === 1 ? 'track' : 'tracks'}`;
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GlassDialogContent
        closeLabel="Cancel"
        role="alertdialog"
        onOpenAutoFocus={(event) => {
          // Start on Cancel, so Enter does not erase anything by accident.
          const cancel = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
            '[data-cancel]',
          );
          if (cancel) {
            event.preventDefault();
            cancel.focus();
          }
        }}
      >
        <GlassDialogTitle className="text-lg font-semibold">Delete {tracks}?</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm">
          The {tracks} will be erased from the disc. This cannot be undone.
        </GlassDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton data-cancel type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </GlassButton>
          <GlassButton type="button" variant="primary" size="sm" onClick={onConfirm}>
            Delete {tracks}
          </GlassButton>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
