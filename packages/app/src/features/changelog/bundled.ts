import markdown from '../../../../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog';

/** The repository's CHANGELOG.md, bundled into the app so it works offline. */
export const BUNDLED_CHANGELOG = parseChangelog(markdown);
