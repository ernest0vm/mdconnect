import type { AppearanceChoice, ThemeOption, TransparencyOption } from './appearance-choice';

export interface AppearanceOption<V extends string> {
  readonly value: V;
  readonly label: string;
  readonly hint?: string;
}

export type AppearanceGroup =
  | {
      readonly field: 'theme';
      readonly legend: string;
      readonly options: readonly AppearanceOption<ThemeOption>[];
    }
  | {
      readonly field: 'transparency';
      readonly legend: string;
      readonly options: readonly AppearanceOption<TransparencyOption>[];
    };

const THEME: readonly AppearanceOption<ThemeOption>[] = [
  { value: 'system', label: 'System', hint: 'Follows the light or dark setting of your system.' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TRANSPARENCY: readonly AppearanceOption<TransparencyOption>[] = [
  {
    value: 'system',
    label: 'System',
    hint: 'Follows the reduce transparency setting of your system.',
  },
  { value: 'reduced', label: 'Reduced', hint: 'Opaque panels, no blur.' },
  { value: 'glass', label: 'Glass', hint: 'Translucent glass panels.' },
];

/** The two choice groups of the Appearance dialog, in display order. */
export function appearanceGroups(): readonly AppearanceGroup[] {
  return [
    { field: 'theme', legend: 'Theme', options: THEME },
    { field: 'transparency', legend: 'Transparency', options: TRANSPARENCY },
  ];
}

const labelOf = <V extends string>(options: readonly AppearanceOption<V>[], value: V) =>
  options.find((o) => o.value === value)?.label ?? value;

/** Accessible name of the Appearance trigger, naming the current choice of each group. */
export function appearanceTriggerLabel(choice: AppearanceChoice): string {
  return `Appearance: theme ${labelOf(THEME, choice.theme)}, transparency ${labelOf(TRANSPARENCY, choice.transparency)}`;
}
