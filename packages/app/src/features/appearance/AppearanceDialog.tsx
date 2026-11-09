import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
  GlassDialogTrigger,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import type { AppearanceChoice } from './appearance-choice';
import {
  appearanceGroups,
  appearanceTriggerLabel,
  withOption,
  type AppearanceGroup,
} from './appearance-options';
import { useAppearanceChoice } from './AppearanceChoiceContext';

/** One fieldset of native radios: arrow keys and Space work, and screen readers get a group. */
function ChoiceGroup({
  group,
  choice,
  onPick,
}: {
  readonly group: AppearanceGroup;
  readonly choice: AppearanceChoice;
  readonly onPick: (next: AppearanceChoice) => void;
}) {
  const current = choice[group.field];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{group.legend}</legend>
      {group.options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="radio"
            name={`appearance-${group.field}`}
            value={option.value}
            checked={current === option.value}
            onChange={() => {
              onPick(withOption(choice, group, option.value));
            }}
            className="mt-0.5 size-4 accent-indigo-600 dark:accent-indigo-300"
          />
          <span className="flex flex-col">
            <span>{option.label}</span>
            {option.hint && <span className="text-xs opacity-80">{option.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** The Appearance control: a footer button that opens the theme and transparency choices. */
export function AppearanceDialog() {
  const { choice, setChoice } = useAppearanceChoice();

  return (
    <GlassDialog>
      {/* The trigger is where Radix returns focus when the dialog closes. */}
      <GlassDialogTrigger asChild>
        <GlassButton variant="ghost" size="sm" aria-label={appearanceTriggerLabel(choice)}>
          Appearance
        </GlassButton>
      </GlassDialogTrigger>
      <GlassDialogContent
        closeLabel="Close"
        onOpenAutoFocus={(event) => {
          // Start on the checked option, as a radio group does, not on the first one.
          const checked = (
            event.currentTarget as HTMLElement | null
          )?.querySelector<HTMLInputElement>('input[type="radio"]:checked');
          if (checked) {
            event.preventDefault();
            checked.focus();
          }
        }}
      >
        <GlassDialogTitle className="text-lg font-semibold">Appearance</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          Changes apply right away and are remembered on this device.
        </GlassDialogDescription>
        <div className="mt-4 flex flex-col gap-5">
          {appearanceGroups().map((group) => (
            <ChoiceGroup key={group.field} group={group} choice={choice} onPick={setChoice} />
          ))}
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
