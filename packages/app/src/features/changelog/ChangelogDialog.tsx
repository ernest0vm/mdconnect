import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';

import { BUNDLED_CHANGELOG } from './bundled';
import type { ChangelogVersion } from './changelog';

/**
 * Lists versions with their changes, newest first: the whole changelog from the menu, or the
 * versions since the last one seen as "What's new".
 */
export function ChangelogDialog({
  title,
  versions = BUNDLED_CHANGELOG,
  onClose,
  returnFocus,
}: {
  readonly title: string;
  readonly versions?: readonly ChangelogVersion[];
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
      <GlassDialogContent closeLabel="Close" returnFocus={returnFocus}>
        <GlassDialogTitle className="text-lg font-semibold">{title}</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          What changed in each version of mdconnect, newest first.
        </GlassDialogDescription>
        {/* Only the list scrolls, so the title and the close button stay in view. */}
        <div className="mt-4 -mr-2 flex max-h-[calc(100dvh-12rem)] flex-col gap-5 overflow-y-auto pr-2">
          {versions.map((entry) => (
            <section key={entry.version} className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">
                {entry.version}
                {entry.date !== '' && (
                  <span className="ml-2 text-sm font-normal opacity-80">{entry.date}</span>
                )}
              </h3>
              {entry.sections.map((section) => (
                <div key={section.title} className="flex flex-col gap-1">
                  <h4 className="text-sm font-semibold">{section.title}</h4>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                    {section.items.map((item, index) => (
                      // Two bullets can read the same, so the position keeps them apart.
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
