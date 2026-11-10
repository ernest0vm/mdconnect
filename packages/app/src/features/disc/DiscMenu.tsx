import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassMenu,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuLinkItem,
  GlassMenuSeparator,
  GlassMenuTrigger,
} from '@mdconnect/ui/components/glassyui/glass-menu';
import { useRef } from 'react';

import { MENU_LINKS, type MenuAvailability } from './menu-view';

export interface DiscMenuProps {
  readonly availability: MenuAvailability;
  readonly onExport: () => void;
  readonly onImport: (file: File) => void;
  readonly onWipe: () => void;
  readonly onAbout: () => void;
  readonly onChangelog: () => void;
  readonly onExit: () => void;
}

/**
 * The More button in the header slot the menu is rendered into, so a dialog opened from the menu
 * can return focus to it when it closes.
 */
export function menuTrigger(slot: HTMLElement | null): HTMLElement | null {
  return slot?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null;
}

/** The More menu: titles as CSV, Wipe disc, About, Changelog, links, and Exit. */
export function DiscMenu({
  availability,
  onExport,
  onImport,
  onWipe,
  onAbout,
  onChangelog,
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
          <GlassMenuItem onSelect={onChangelog}>Changelog</GlassMenuItem>
          {MENU_LINKS.map((link) => (
            <GlassMenuLinkItem key={link.href} href={link.href}>
              {link.label}
            </GlassMenuLinkItem>
          ))}
          <GlassMenuSeparator />
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
