import type { Disc } from '@mdconnect/netmd';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { GlassInput } from '@mdconnect/ui/components/glassyui/glass-input';
import { useId, useMemo, useState } from 'react';

import { currentTitles, titleForm, type TitleForm, type TitleTarget } from './title-form';

export interface TitleDialogProps {
  readonly disc: Disc;
  readonly target: TitleTarget;
  readonly heading: string;
  readonly saveLabel: string;
  readonly onSave: (form: TitleForm) => void;
  readonly onClose: () => void;
}

/** One title input with what will be stored and the space left. */
function TitleField({
  label,
  value,
  stored,
  remaining,
  onChange,
}: {
  label: string;
  value: string;
  stored: string;
  remaining: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hint = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <GlassInput
        id={id}
        value={value}
        aria-describedby={hint}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p id={hint} className="text-xs opacity-80">
        {stored !== value && value !== '' ? (
          <>
            Saved as “<span className="font-mono">{stored}</span>”.{' '}
          </>
        ) : null}
        {remaining}
      </p>
    </div>
  );
}

/** Edits a half-width and a full-width title, showing what will be stored and the space left. */
export function TitleDialog({
  disc,
  target,
  heading,
  saveLabel,
  onSave,
  onClose,
}: TitleDialogProps) {
  const [input, setInput] = useState(() => currentTitles(disc, target));
  const form = useMemo(() => titleForm(disc, target, input), [disc, target, input]);
  const changed = form.halfWidthChanged || form.fullWidthChanged || target.kind === 'new-group';
  const canSave = form.fits && changed && !form.missingTitle;

  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Cancel">
        <GlassDialogTitle className="text-lg font-semibold">{heading}</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          The disc stores plain letters, numbers and half-width katakana. A full-width title can
          hold Japanese text.
        </GlassDialogDescription>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) onSave(form);
          }}
        >
          <TitleField
            label="Title"
            value={input.halfWidth}
            stored={form.halfWidth}
            remaining={`${String(form.remaining.halfWidth)} characters left on the disc.`}
            onChange={(halfWidth) => {
              setInput((current) => ({ ...current, halfWidth }));
            }}
          />
          <TitleField
            label="Full-width title (optional)"
            value={input.fullWidth}
            stored={form.fullWidth}
            remaining={`${String(Math.floor(form.remaining.fullWidth / 2))} full-width characters left on the disc.`}
            onChange={(fullWidth) => {
              setInput((current) => ({ ...current, fullWidth }));
            }}
          />
          {form.missingTitle && <p className="text-sm">A group needs a title.</p>}
          {!form.fits && (
            <p role="alert" className="text-sm font-semibold text-red-800 dark:text-red-200">
              This title does not fit in the space left on the disc. Shorten it to save.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" size="sm" disabled={!canSave}>
              {saveLabel}
            </GlassButton>
          </div>
        </form>
      </GlassDialogContent>
    </GlassDialog>
  );
}
