import { describe, expect, it } from 'vitest';

import { DEFAULT_APPEARANCE_CHOICE } from './appearance-choice';
import { appearanceGroups, appearanceTriggerLabel } from './appearance-options';

describe('appearanceGroups (ui-theme: "Appearance control")', () => {
  it('offers Theme and Transparency, each starting with System', () => {
    const groups = appearanceGroups();
    expect(groups.map((g) => g.legend)).toEqual(['Theme', 'Transparency']);
    expect(groups[0]?.options.map((o) => o.label)).toEqual(['System', 'Light', 'Dark']);
    expect(groups[1]?.options.map((o) => o.label)).toEqual(['System', 'Reduced', 'Glass']);
  });

  it('explains what each transparency option does', () => {
    const [, transparency] = appearanceGroups();
    expect(transparency?.options.find((o) => o.value === 'reduced')?.hint).toMatch(/opaque/i);
  });
});

describe('appearanceTriggerLabel (ui-theme: "Change theme from the control")', () => {
  it('announces the current choice of each group', () => {
    expect(appearanceTriggerLabel(DEFAULT_APPEARANCE_CHOICE)).toBe(
      'Appearance: theme System, transparency System',
    );
    expect(appearanceTriggerLabel({ theme: 'dark', transparency: 'reduced' })).toBe(
      'Appearance: theme Dark, transparency Reduced',
    );
  });
});
