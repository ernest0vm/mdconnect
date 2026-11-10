import {
  THEME_OPTIONS,
  TRANSPARENCY_OPTIONS,
  type AppearanceChoice,
  type ThemeOption,
  type TransparencyOption,
} from './appearance-choice';

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

/** The two choice groups of the Appearance section, in display order. */
export function appearanceGroups(): readonly AppearanceGroup[] {
  return [
    { field: 'theme', legend: 'Theme', options: THEME },
    { field: 'transparency', legend: 'Transparency', options: TRANSPARENCY },
  ];
}

const isOneOf = <T extends string>(options: readonly T[], value: string): value is T =>
  (options as readonly string[]).includes(value);

/** The choice with `value` set on the group's own field; unchanged if the value is not one of its options. */
export function withOption(
  choice: AppearanceChoice,
  group: AppearanceGroup,
  value: string,
): AppearanceChoice {
  if (group.field === 'theme') {
    return isOneOf(THEME_OPTIONS, value) ? { ...choice, theme: value } : choice;
  }
  return isOneOf(TRANSPARENCY_OPTIONS, value) ? { ...choice, transparency: value } : choice;
}
