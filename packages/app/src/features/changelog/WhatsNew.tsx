import { useEffect, useState } from 'react';

import { browserStorage } from '../../browser-storage';
import { BUNDLED_CHANGELOG } from './bundled';
import { ChangelogDialog } from './ChangelogDialog';
import { readLastSeen, rememberVersion, whatsNew } from './whats-new';

/** Opens "What's new" once when the app starts with a version newer than the last one shown. */
export function WhatsNew({ version }: { readonly version: string }) {
  const [versions, setVersions] = useState(() =>
    whatsNew(readLastSeen(browserStorage()), version, BUNDLED_CHANGELOG),
  );

  // Stored after the first render, so StrictMode's second render reads the same last version.
  useEffect(() => {
    rememberVersion(browserStorage(), version);
  }, [version]);

  if (versions.length === 0) return null;
  return (
    <ChangelogDialog
      title="What's new"
      versions={versions}
      onClose={() => {
        setVersions([]);
      }}
    />
  );
}
