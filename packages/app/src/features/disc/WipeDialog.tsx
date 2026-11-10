import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';

/** Asks before erasing the whole disc: nothing on it can be recovered afterwards. */
export function WipeDialog({
  discName,
  onConfirm,
  onClose,
  returnFocus,
}: {
  readonly discName: string;
  readonly onConfirm: () => void;
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
      <GlassDialogContent
        returnFocus={returnFocus}
        closeLabel="Cancel"
        role="alertdialog"
        onOpenAutoFocus={(event) => {
          // Start on Cancel, so Enter does not erase the disc by accident.
          const cancel = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
            '[data-cancel]',
          );
          if (cancel) {
            event.preventDefault();
            cancel.focus();
          }
        }}
      >
        <GlassDialogTitle className="text-lg font-semibold">Wipe “{discName}”?</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm">
          Every track and title on this disc will be erased. This cannot be undone.
        </GlassDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton data-cancel type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </GlassButton>
          <GlassButton type="button" variant="primary" size="sm" onClick={onConfirm}>
            Wipe disc
          </GlassButton>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
