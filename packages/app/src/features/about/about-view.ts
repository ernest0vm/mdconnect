/** The build line in About: the short commit, or a note that this is a development build. */
export function buildLabel(commit: string): string {
  return commit === '' ? 'Development build' : `Build ${commit.slice(0, 12)}`;
}
