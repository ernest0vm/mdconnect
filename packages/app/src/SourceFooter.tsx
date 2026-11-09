import { licenseName, sourceLink } from '@mdconnect/core';

/** GPL-2.0 source offer: shown on every screen, linking to the commit this build came from. */
export function SourceFooter({ commit }: { readonly commit: string }) {
  return (
    <footer className="text-xs opacity-80">
      mdconnect is free software under {licenseName}.{' '}
      <a className="underline" href={sourceLink(commit)} target="_blank" rel="noreferrer">
        Source code
      </a>
    </footer>
  );
}
