/**
 * The page's `localStorage`, or null when the profile blocks it: reading `window.localStorage`
 * itself throws there (private browsing, blocked site data).
 */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
