/** What is using the deck's playback, which every other control waits for. */
export type DeckBusy = 'recording' | 'identifying' | null;

/** The reason every other control gives while a recording runs. */
export const RECORDING_IN_PROGRESS = 'Wait for the recording to finish.';

/** The reason every other control gives while identification listens to the deck. */
export const IDENTIFYING_IN_PROGRESS = 'Wait for identification to finish.';

/** Why the deck cannot be used for anything else now, or null. */
export function deckBusyReason(deckBusy: DeckBusy | undefined): string | null {
  if (deckBusy === 'recording') return RECORDING_IN_PROGRESS;
  if (deckBusy === 'identifying') return IDENTIFYING_IN_PROGRESS;
  return null;
}
