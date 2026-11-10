import type { AppearanceChoice } from './appearance-choice';
import { appearanceGroups, withOption, type AppearanceGroup } from './appearance-options';
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

/** The theme and transparency choices, the Appearance section of Settings. */
export function AppearanceSection() {
  const { choice, setChoice } = useAppearanceChoice();
  return (
    <div className="flex flex-col gap-5">
      {appearanceGroups().map((group) => (
        <ChoiceGroup key={group.field} group={group} choice={choice} onPick={setChoice} />
      ))}
    </div>
  );
}
