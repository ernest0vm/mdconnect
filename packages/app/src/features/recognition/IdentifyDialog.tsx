import type { Disc } from '@mdconnect/netmd';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { GlassInput } from '@mdconnect/ui/components/glassyui/glass-input';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { EditPlan } from '../disc/edit-plan';
import { AudioInputField } from '../recording/AudioInputField';
import type { LiveCapture } from '../recording/capture-source';
import type { RecordingDeck, RecordingTrack } from '../recording/session';
import { useLiveInput } from '../recording/useLiveInput';
import { useUploadPreferences } from '../upload/UploadPreferencesContext';
import { reviewNewTitles } from './apply-titles';
import { chromaprintFingerprinter, loadChromaprint } from './fingerprint';
import {
  acoustIdIdentifier,
  offlineResampler,
  shazamIdentifier,
  type ShazamAsk,
} from './identifiers';
import { identifyTracks, type IdentifyProgress } from './identify-session';
import {
  consentNeeded,
  consentNotice,
  endingNotice,
  identifyProgressLabel,
  initialRows,
  listeningEstimate,
  methodChoices,
  needsInput,
  newTitleOf,
  resultLabel,
  resultLine,
  rowsToListen,
  searchBlocker,
  titlesToApply,
  withResult,
  type IdentifyRow,
} from './identify-view';
import { MusicBrainzClient, type SearchResult } from './musicbrainz';
import {
  availableMethod,
  withConsent,
  type IdentifyMethod,
  type RecognitionService,
} from './recognition-preferences';
import { useRecognitionPreferences } from './RecognitionPreferencesContext';
import { TITLE_SOURCE_LABELS } from '../upload/upload-view';
import { TITLE_FORMATS, type TitleFormat } from './title-format';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const browserFetch = (url: string, init: RequestInit) => fetch(url, init);

/** Chromaprint is loaded once, on the first AcoustID listen, and kept for the session. */
const fingerprinter = chromaprintFingerprinter(loadChromaprint);

const selectClass =
  'rounded-lg border border-[var(--lg-border)] bg-[var(--lg-control-surface)] px-2 py-1.5 text-sm';

interface Search {
  readonly state: 'searching' | 'done' | 'failed';
  readonly results: readonly SearchResult[];
}

/** Opens the chosen input for as long as a listening method is chosen, and reports its capture. */
function ListeningInput({
  locked,
  onCapture,
}: {
  readonly locked: boolean;
  readonly onCapture: (capture: LiveCapture | null) => void;
}) {
  const live = useLiveInput();
  useEffect(() => {
    onCapture(live.capture);
  }, [live.capture, onCapture]);
  useEffect(
    () => () => {
      onCapture(null);
    },
    [onCapture],
  );
  return <AudioInputField live={live} locked={locked} />;
}

/**
 * Finds the songs on the selected tracks by listening to the deck (Shazam or AcoustID) or by
 * searching MusicBrainz, then writes the titles the user keeps to the disc.
 */
export function IdentifyDialog({
  tracks,
  disc,
  deck,
  shazam,
  onApply,
  onListeningChange,
  onInterrupted,
  onClose,
  returnFocus,
}: {
  readonly tracks: readonly RecordingTrack[];
  readonly disc: Disc;
  readonly deck: RecordingDeck;
  /** Asks Shazam; undefined where Shazam cannot be used (the web app). */
  readonly shazam: ShazamAsk | undefined;
  /** Runs the title plan; resolves true once the device saved it. */
  readonly onApply: (plan: EditPlan) => Promise<boolean>;
  /** Called when listening starts and ends, so the panel blocks the deck meanwhile. */
  readonly onListeningChange: (listening: boolean) => void;
  /** Called with true when the dialog goes away (the device was unplugged) while listening, and
   * with false when a listen starts. */
  readonly onInterrupted: (interrupted: boolean) => void;
  readonly onClose: () => void;
  readonly returnFocus?: () => HTMLElement | null;
}) {
  const formatId = useId();
  const { preferences, setPreferences } = useRecognitionPreferences();
  const fullWidthTitles = useUploadPreferences().preferences.fullWidth;
  const method = availableMethod(preferences.method, shazam !== undefined);
  const format = preferences.titleFormat;
  const [rows, setRows] = useState<IdentifyRow[]>(() => initialRows(tracks));
  const [searches, setSearches] = useState<ReadonlyMap<number, Search>>(new Map());
  const [capture, setCapture] = useState<LiveCapture | null>(null);
  const [progress, setProgress] = useState<IdentifyProgress | null>(null);
  const [listening, setListening] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  /** A consent the user must answer before `then` sends anything to the service. */
  const [asking, setAsking] = useState<{
    readonly service: RecognitionService;
    readonly then: () => void;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const musicBrainz = useMemo(
    () => new MusicBrainzClient({ fetch: browserFetch, sleep, now: Date.now }),
    [],
  );

  // A dialog that goes away while listening (the device was unplugged) stops as disconnected.
  useEffect(
    () => () => {
      if (controller.current !== null) {
        controller.current.abort('disconnected');
        onInterrupted(true);
      }
    },
    [onInterrupted],
  );

  /** Runs `action` once the user agreed to send data to the method's service. */
  const withServiceConsent = (chosen: IdentifyMethod, action: () => void) => {
    const service = consentNeeded(preferences, chosen);
    if (service === null) action();
    else setAsking({ service, then: action });
  };

  const listen = async (chosen: IdentifyMethod, live: LiveCapture) => {
    const pending = rowsToListen(rows);
    if (pending.length === 0) return;
    const abort = new AbortController();
    controller.current = abort;
    setNotice(null);
    setStopping(false);
    setListening(true);
    onInterrupted(false);
    onListeningChange(true);
    try {
      const identifier =
        chosen === 'shazam' && shazam !== undefined
          ? shazamIdentifier(shazam, offlineResampler(), sleep)
          : acoustIdIdentifier(fingerprinter, browserFetch, sleep);
      const outcome = await identifyTracks(
        pending.map((row) => ({
          index: row.index,
          title: row.current,
          fullWidthTitle: '',
          seconds: row.seconds,
        })),
        {
          deck,
          capture: live,
          identifier,
          sleep,
          signal: abort.signal,
          onProgress: setProgress,
          onResult: (position, result) => {
            const index = pending[position]?.index;
            setRows((current) =>
              withResult(
                current,
                current.findIndex((row) => row.index === index),
                result,
              ),
            );
          },
        },
      );
      if (outcome.ending !== 'disconnected') setNotice(endingNotice(outcome.ending));
    } finally {
      controller.current = null;
      setProgress(null);
      setListening(false);
      onListeningChange(false);
    }
  };

  const search = (position: number, text: string) => {
    setSearches((current) => new Map(current).set(position, { state: 'searching', results: [] }));
    musicBrainz.search(text).then(
      (results) => {
        setSearches((current) => new Map(current).set(position, { state: 'done', results }));
      },
      () => {
        setSearches((current) => new Map(current).set(position, { state: 'failed', results: [] }));
      },
    );
  };

  const updateRow = (position: number, change: Partial<IdentifyRow>) => {
    setRows((current) => current.map((row, at) => (at === position ? { ...row, ...change } : row)));
  };

  const review = reviewNewTitles(disc, titlesToApply(rows, format), {
    fullWidth: fullWidthTitles,
  });
  const stored = new Map(review.titles.map((title) => [title.index, title]));
  const busy = listening || applying;
  const pendingCount = rowsToListen(rows).length;
  const count = tracks.length;

  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Close" className="max-w-3xl" returnFocus={returnFocus}>
        <GlassDialogTitle className="text-lg font-semibold">
          Identify {count === 1 ? 'track' : `${String(count)} tracks`}
        </GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          Find each track’s song, check the new titles, then apply the ones you keep.
        </GlassDialogDescription>
        <div className="mt-4 -mr-2 flex max-h-[calc(100dvh-12rem)] flex-col gap-4 overflow-y-auto pr-2 text-sm">
          <fieldset className="flex flex-col gap-1" disabled={busy}>
            <legend className="mb-1 font-semibold">How to find the songs</legend>
            {methodChoices(shazam !== undefined).map((choice) => (
              <label key={choice.method} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="identify-method"
                  className="mt-0.5 accent-indigo-600 dark:accent-indigo-300"
                  value={choice.method}
                  checked={method === choice.method}
                  disabled={choice.blocker !== null}
                  onChange={() => {
                    setPreferences({ ...preferences, method: choice.method });
                  }}
                />
                <span>
                  {choice.label}
                  {choice.blocker !== null && (
                    <span className="block text-xs opacity-80">{choice.blocker}</span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>

          {needsInput(method) && (
            <div className="flex flex-col gap-3">
              <p>
                Connect the deck’s line-out or headphone output to the computer’s audio input and
                choose it below. The deck plays each track from its start while mdconnect listens.{' '}
                {listeningEstimate(rowsToListen(rows), method)}
              </p>
              <ListeningInput locked={busy} onCapture={setCapture} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={formatId} className="font-semibold">
              New titles as
            </label>
            <select
              id={formatId}
              className={selectClass}
              value={format}
              disabled={busy}
              onChange={(event) => {
                setPreferences({ ...preferences, titleFormat: event.target.value as TitleFormat });
              }}
            >
              {TITLE_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {TITLE_SOURCE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {asking !== null && (
            <GlassAlert tone="info" title={consentNotice(asking.service).title}>
              <p>{consentNotice(asking.service).body}</p>
              <div className="mt-2 flex gap-2">
                <GlassButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setPreferences(withConsent(preferences, asking.service));
                    const then = asking.then;
                    setAsking(null);
                    then();
                  }}
                >
                  Agree and continue
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAsking(null);
                  }}
                >
                  Do not send
                </GlassButton>
              </div>
            </GlassAlert>
          )}

          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Tracks and their new titles</caption>
            <thead>
              <tr className="border-b border-[var(--lg-border)]">
                <th scope="col" className="w-8 py-1">
                  <span className="sr-only">Apply</span>
                </th>
                <th scope="col" className="w-10 py-1">
                  #
                </th>
                <th scope="col" className="py-1">
                  Current title
                </th>
                <th scope="col" className="py-1">
                  New title
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, position) => {
                const title = newTitleOf(row, format);
                const saved = stored.get(row.index);
                const found = searches.get(position);
                return (
                  <tr key={row.index} className="border-b border-[var(--lg-border)] align-top">
                    <td className="py-2">
                      <GlassCheckbox
                        aria-label={`Apply a new title to track ${String(row.number)}`}
                        checked={row.ticked}
                        disabled={busy}
                        onChange={() => {
                          updateRow(position, { ticked: !row.ticked });
                        }}
                      />
                    </td>
                    <td className="py-2">{row.number}</td>
                    <td className="py-2">{row.current}</td>
                    <td className="flex flex-col gap-1 py-2">
                      <GlassInput
                        aria-label={`New title for track ${String(row.number)}`}
                        value={title ?? ''}
                        placeholder={resultLabel(row)}
                        disabled={busy}
                        onChange={(event) => {
                          updateRow(position, { edited: event.target.value });
                        }}
                      />
                      {saved !== undefined && title !== null && saved.halfWidth !== title && (
                        <span className="text-xs opacity-80">
                          Saved as “{saved.halfWidth}”
                          {saved.fullWidth !== '' && ` and “${saved.fullWidth}”`}
                        </span>
                      )}
                      {method === 'search' && (
                        <SearchRow
                          row={row}
                          search={found}
                          busy={busy}
                          onText={(searchText) => {
                            updateRow(position, { searchText });
                          }}
                          onSearch={() => {
                            withServiceConsent('search', () => {
                              search(position, row.searchText);
                            });
                          }}
                          onPick={(result) => {
                            setRows((current) =>
                              withResult(current, position, { kind: 'found', song: result.song }),
                            );
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {listening && (
            <p role="status" aria-live="polite" className="font-semibold">
              {progress === null ? 'Starting…' : identifyProgressLabel(progress, method)}
            </p>
          )}
          {notice !== null && (
            <GlassAlert tone="warning" title="Identification stopped">
              <p>{notice}</p>
            </GlassAlert>
          )}
          {review.blocker !== null && !listening && (
            <p className="text-xs opacity-80">{review.blocker}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {listening ? (
              <GlassButton
                type="button"
                variant="soft"
                size="sm"
                disabled={stopping}
                onClick={() => {
                  setStopping(true);
                  controller.current?.abort('cancelled');
                }}
              >
                {stopping ? 'Stopping…' : 'Cancel'}
              </GlassButton>
            ) : (
              <>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={applying}
                  onClick={onClose}
                >
                  Close
                </GlassButton>
                {needsInput(method) && (
                  <GlassButton
                    type="button"
                    variant="soft"
                    size="sm"
                    disabled={capture === null || pendingCount === 0 || applying}
                    onClick={() => {
                      if (capture === null) return;
                      withServiceConsent(method, () => {
                        void listen(method, capture);
                      });
                    }}
                  >
                    Identify {pendingCount === count ? '' : `${String(pendingCount)} remaining `}
                    by listening
                  </GlassButton>
                )}
                <GlassButton
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={review.blocker !== null || applying}
                  onClick={() => {
                    setApplying(true);
                    void onApply(review.plan).then((saved) => {
                      setApplying(false);
                      if (saved) onClose();
                    });
                  }}
                >
                  Apply new titles
                </GlassButton>
              </>
            )}
          </div>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}

/** Search by name for one track: the text, Search, and the results to pick from. */
function SearchRow({
  row,
  search,
  busy,
  onText,
  onSearch,
  onPick,
}: {
  readonly row: IdentifyRow;
  readonly search: Search | undefined;
  readonly busy: boolean;
  readonly onText: (text: string) => void;
  readonly onSearch: () => void;
  readonly onPick: (result: SearchResult) => void;
}) {
  const blocker = searchBlocker(row.searchText);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <GlassInput
          aria-label={`Search text for track ${String(row.number)}`}
          value={row.searchText}
          disabled={busy}
          onChange={(event) => {
            onText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && blocker === null) onSearch();
          }}
        />
        <GlassButton
          type="button"
          variant="soft"
          size="sm"
          disabled={blocker !== null || busy || search?.state === 'searching'}
          title={blocker ?? undefined}
          onClick={onSearch}
        >
          Search
        </GlassButton>
      </div>
      {blocker !== null && <span className="text-xs opacity-80">{blocker}</span>}
      {search?.state === 'searching' && <span className="text-xs">Searching…</span>}
      {search?.state === 'failed' && (
        <span className="text-xs">The service could not be reached.</span>
      )}
      {search?.state === 'done' && search.results.length === 0 && (
        <span className="text-xs">No recording was found.</span>
      )}
      {search?.state === 'done' && search.results.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={`Results for track ${String(row.number)}`}>
          {search.results.map((result) => (
            <li key={result.id}>
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start text-left whitespace-normal"
                disabled={busy}
                onClick={() => {
                  onPick(result);
                }}
              >
                {resultLine(result)}
              </GlassButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
