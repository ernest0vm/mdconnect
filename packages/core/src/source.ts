/** Where the corresponding source of every build lives (GPL-2.0 offer). */
export const sourceRepositoryUrl = 'https://github.com/ernest0vm/mdconnect';

export const licenseName = 'GPL-2.0';

/** Links to the exact commit a build was made from, or the repository root when unknown. */
export function sourceLink(commit: string): string {
  return commit === '' ? sourceRepositoryUrl : `${sourceRepositoryUrl}/tree/${commit}`;
}
