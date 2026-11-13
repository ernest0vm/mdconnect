/** Narrowing for the JSON the recognition services answer with, which is never trusted as typed. */

export const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The value as a list, or an empty one when it is not an array. */
export const jsonList = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/** The value as text, or null when it is not a string. */
export const jsonText = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;
