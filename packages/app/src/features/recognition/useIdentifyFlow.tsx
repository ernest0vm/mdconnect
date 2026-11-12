import type { Disc } from '@mdconnect/netmd';
import { useRef, useState, type ReactNode } from 'react';

import type { DiscReader } from '../disc/disc-reader';
import type { EditPlan } from '../disc/edit-plan';
import type { RecordingTrack } from '../recording/session';
import { readerDeck } from '../recording/useRecordFlow';
import type { ShazamAsk } from './identifiers';
import { IdentifyDialog } from './IdentifyDialog';

export interface IdentifyFlowOptions {
  readonly reader: DiscReader;
  /** The disc as read; null while it is not shown, which closes the dialog. */
  readonly disc: Disc | null;
  /** Asks Shazam; undefined where Shazam cannot be used. */
  readonly shazam: ShazamAsk | undefined;
  /** Runs the title plan; resolves true once the device saved it. */
  readonly onEdit: (plan: EditPlan) => Promise<boolean>;
  /** Called when listening starts and ends, so the panel blocks the deck meanwhile. */
  readonly onListeningChange: (listening: boolean) => void;
  /**
   * Called with true when the device's disconnection stopped a listen, for the Connect screen to
   * say, and with false when a new listen starts.
   */
  readonly onInterrupted: (interrupted: boolean) => void;
}

export interface IdentifyFlow {
  /** Opens the Identify dialog for these tracks. */
  readonly identify: (tracks: readonly RecordingTrack[]) => void;
  readonly dialogs: ReactNode;
}

/** The Identify dialog for the selected tracks, which returns focus to Identify when it closes. */
export function useIdentifyFlow({
  reader,
  disc,
  shazam,
  onEdit,
  onListeningChange,
  onInterrupted,
}: IdentifyFlowOptions): IdentifyFlow {
  const [tracks, setTracks] = useState<readonly RecordingTrack[] | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dialogs =
    tracks === null || disc === null ? null : (
      <IdentifyDialog
        tracks={tracks}
        disc={disc}
        deck={readerDeck(reader, disc.trackCount)}
        shazam={shazam}
        onApply={onEdit}
        onListeningChange={onListeningChange}
        onInterrupted={onInterrupted}
        onClose={() => {
          setTracks(null);
        }}
        returnFocus={() => (opener.current?.isConnected === true ? opener.current : null)}
      />
    );
  return {
    identify: (selected) => {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTracks(selected);
    },
    dialogs,
  };
}
