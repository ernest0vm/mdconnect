import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';

/** A button that stays focusable while unavailable, so keyboard focus is not lost mid-edit. */
export function Action({
  label,
  blocked,
  describedBy,
  onRun,
}: {
  label: string;
  blocked: boolean;
  describedBy?: string | undefined;
  onRun: () => void;
}) {
  return (
    <GlassButton
      variant="soft"
      size="sm"
      aria-disabled={blocked}
      aria-describedby={blocked ? describedBy : undefined}
      onClick={() => {
        if (!blocked) onRun();
      }}
    >
      {label}
    </GlassButton>
  );
}
