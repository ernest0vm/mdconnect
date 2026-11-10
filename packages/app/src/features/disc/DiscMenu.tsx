import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassMenu,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuSeparator,
  GlassMenuTrigger,
} from '@mdconnect/ui/components/glassyui/glass-menu';
import { useRef } from 'react';

import type { MenuAvailability } from './menu-view';

export interface DiscMenuProps {
  readonly availability: MenuAvailability;
  readonly onExport: () => void;
  readonly onImport: (file: File) => void;
  readonly onWipe: () => void;
  readonly onAbout: () => void;
  readonly onExit: () => void;
}

/**
 * The More button in the header slot the menu is rendered into, so a dialog opened from the menu
 * can return focus to it when it closes.
 */
export function menuTrigger(slot: HTMLElement | null): HTMLElement | null {
  return slot?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null;
}

/** The More menu: titles as CSV, Wipe disc, About and Exit. */
export function DiscMenu({
  availability,
  onExport,
  onImport,
  onWipe,
  onAbout,
  onExit,
}: DiscMenuProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <GlassMenu>
        <GlassMenuTrigger asChild>
          <GlassButton variant="soft" size="sm">
            More
          </GlassButton>
        </GlassMenuTrigger>
        <GlassMenuContent aria-label="More">
          <GlassMenuItem
            disabled={availability.export !== null}
            reason={availability.export}
            onSelect={onExport}
          >
            Export titles to CSV
          </GlassMenuItem>
          <GlassMenuItem
            disabled={availability.import !== null}
            reason={availability.import}
            onSelect={() => fileInput.current?.click()}
          >
            Import titles from CSV
          </GlassMenuItem>
          <GlassMenuItem
            disabled={availability.wipe !== null}
            reason={availability.wipe}
            onSelect={onWipe}
          >
            Wipe disc
          </GlassMenuItem>
          <GlassMenuSeparator />
          <GlassMenuItem onSelect={onAbout}>About</GlassMenuItem>
          <GlassMenuItem onSelect={onExit}>Exit</GlassMenuItem>
        </GlassMenuContent>
      </GlassMenu>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onImport(file);
        }}
      />
    </>
  );
}
