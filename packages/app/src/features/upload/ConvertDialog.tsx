import type { Disc } from '@mdconnect/netmd';
import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassBadge } from '@mdconnect/ui/components/glassyui/glass-badge';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { GlassInput } from '@mdconnect/ui/components/glassyui/glass-input';
import { GlassMeter } from '@mdconnect/ui/components/glassyui/glass-meter';
import { ONLINE_ENCODER_ORIGIN } from '@mdconnect/core';
import { useEffect, useId, useRef, useState } from 'react';

import type { Encoder, RecordingMode } from './convert-track';
import { loadItem, loadItemSafely, type LoadedItem } from './item-loader';
import { baseName, titleFromSource, type TitleSource } from './title-source';
import type { UploadPreferences } from './upload-preferences';
import {
  audioFiles,
  ENCODER_LABELS,
  fitView,
  formatSeconds,
  initialMode,
  MODE_LABELS,
  moveItem,
  removeItem,
  retitle,
  skipReasonText,
  TITLE_SOURCE_LABELS,
  type ConvertItem,
} from './upload-view';

/** What the user chose in the dialog, ready to upload. */
export interface UploadJob {
  readonly items: readonly ConvertItem[];
  readonly mode: RecordingMode;
  readonly preferences: UploadPreferences;
}

export interface ConvertDialogProps {
  readonly files: readonly File[];
  readonly disc: Disc;
  readonly modes: readonly RecordingMode[];
  readonly preferences: UploadPreferences;
  readonly onUpload: (job: UploadJob) => void;
  /** Called when the user agrees to the online encoder, so the consent is kept. */
  readonly onPreferences: (preferences: UploadPreferences) => void;
  readonly onClose: () => void;
  readonly load?: (file: File) => Promise<LoadedItem>;
}

const ONLINE_HOST = new URL(ONLINE_ENCODER_ORIGIN).host;
const ENCODERS: readonly Encoder[] = ['built-in', 'online'];
const radioClass =
  'size-4 shrink-0 cursor-pointer accent-indigo-600 dark:accent-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

let nextId = 1;

function newItem(file: File): ConvertItem {
  return {
    id: nextId++,
    file,
    tags: null,
    durationSeconds: null,
    atrac: null,
    problem: null,
    title: baseName(file.name),
    fullWidthTitle: '',
    edited: false,
  };
}

function RadioRow<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              className={radioClass}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Lists the files to upload with their titles, and the recording options. Shows whether the
 * tracks fit on the disc, and asks before the online encoder is first used.
 */
export function ConvertDialog({
  files,
  disc,
  modes,
  preferences,
  onUpload,
  onPreferences,
  onClose,
  load = loadItem,
}: ConvertDialogProps) {
  const [items, setItems] = useState<readonly ConvertItem[]>(() => files.map(newItem));
  const [mode, setMode] = useState<RecordingMode>(() => initialMode(preferences.mode, modes));
  const [encoder, setEncoder] = useState<Encoder>(preferences.encoder);
  const [titleSource, setTitleSource] = useState<TitleSource>(preferences.titleSource);
  const [fullWidth, setFullWidth] = useState(preferences.fullWidth);
  const [replayGain, setReplayGain] = useState(preferences.replayGain);
  const [askConsent, setAskConsent] = useState(false);
  const [rejected, setRejected] = useState<readonly string[]>([]);
  const loading = useRef(new Set<number>());
  // A load that finishes after the source changed must title with the current source.
  const sourceRef = useRef(titleSource);
  const moreInput = useRef<HTMLInputElement>(null);
  const id = useId();

  // Read each new file once: its tags, length and whether it is pre-encoded ATRAC3.
  useEffect(() => {
    for (const item of items) {
      if (item.tags !== null || loading.current.has(item.id)) continue;
      loading.current.add(item.id);
      // Any loader, the default or one passed in, ends with a result: a failure marks the file.
      void loadItemSafely(item.file, load).then((loaded) => {
        setItems((current) =>
          current.map((entry) =>
            entry.id !== item.id
              ? entry
              : {
                  ...entry,
                  ...loaded,
                  title: entry.edited
                    ? entry.title
                    : titleFromSource(sourceRef.current, loaded.tags ?? {}, entry.file.name),
                },
          ),
        );
      });
    }
  }, [items, load]);

  const lp = mode === 'lp2' || mode === 'lp4';
  const uploadCount = items.filter((item) => item.problem === null).length;
  // Pre-encoded ATRAC3 files are uploaded as they are and never sent to the online encoder.
  const sentCount = items.filter((item) => item.problem === null && item.atrac === null).length;
  const sendsOnline = lp && encoder === 'online' && sentCount > 0;
  // Derived from the current list, so the prompt goes away once nothing would be sent.
  const consentPending = askConsent && sendsOnline;
  const fit = fitView(items, mode, disc, fullWidth);
  const chosen: UploadPreferences = {
    mode,
    titleSource,
    fullWidth,
    replayGain,
    encoder,
    onlineConsent: preferences.onlineConsent,
  };

  const upload = (consented: UploadPreferences = chosen) => {
    onUpload({ items, mode, preferences: consented });
  };
  const addFiles = (picked: readonly File[]) => {
    const { accepted, rejected: others } = audioFiles(picked);
    setRejected(others);
    setItems((current) => [...current, ...accepted.map(newItem)]);
  };

  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Cancel" className="max-w-2xl">
        <GlassDialogTitle className="text-lg font-semibold">Add tracks</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          Nothing is written until you upload. New tracks go after the last track on the disc.
        </GlassDialogDescription>
        <div className="mt-4 flex flex-col gap-4">
          <RadioRow
            legend="Recording mode"
            name={`${id}-mode`}
            value={mode}
            options={modes.map((value) => ({ value, label: MODE_LABELS[value] }))}
            onChange={(value) => {
              setMode(value);
              // A pending consent prompt is about the choice that opened it.
              setAskConsent(false);
            }}
          />
          {lp && (
            <div className="flex flex-col gap-1.5">
              <RadioRow
                legend="LP encoder"
                name={`${id}-encoder`}
                value={encoder}
                options={ENCODERS.map((value) => ({ value, label: ENCODER_LABELS[value] }))}
                onChange={(value) => {
                  setEncoder(value);
                  setAskConsent(false);
                }}
              />
              <p className="text-xs opacity-80">
                {encoder === 'built-in'
                  ? "The built-in encoder works offline, but its quality is lower than Sony's."
                  : `Your audio files are sent to ${ONLINE_HOST} to be encoded.`}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-source`} className="text-sm font-semibold">
              Track titles from
            </label>
            <select
              id={`${id}-source`}
              className="rounded-lg border border-[var(--lg-border)] bg-[var(--lg-control-surface)] px-2 py-1.5 text-sm"
              value={titleSource}
              onChange={(event) => {
                const source = event.target.value as TitleSource;
                setTitleSource(source);
                sourceRef.current = source;
                setItems((current) => retitle(current, source));
              }}
            >
              {Object.entries(TITLE_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <GlassCheckbox
                checked={fullWidth}
                onChange={() => {
                  setFullWidth((value) => !value);
                }}
              />
              Full-width titles
            </label>
            <label className="flex items-center gap-2 text-sm">
              <GlassCheckbox
                checked={replayGain}
                onChange={() => {
                  setReplayGain((value) => !value);
                }}
              />
              Use ReplayGain
            </label>
          </div>

          <ol aria-label="Tracks to upload" className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex flex-col gap-1.5 rounded-xl border border-[var(--lg-border)] p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-right text-sm tabular-nums opacity-80">
                    {index + 1}
                  </span>
                  <GlassInput
                    aria-label={`Title of track ${String(index + 1)}`}
                    className="min-w-0 flex-1"
                    value={item.title}
                    onChange={(event) => {
                      const title = event.target.value;
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id ? { ...entry, title, edited: true } : entry,
                        ),
                      );
                    }}
                  />
                  <GlassButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move track ${String(index + 1)} up`}
                    aria-disabled={index === 0}
                    onClick={() => {
                      if (index > 0) setItems((current) => moveItem(current, index, -1));
                    }}
                  >
                    ↑
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move track ${String(index + 1)} down`}
                    aria-disabled={index === items.length - 1}
                    onClick={() => {
                      if (index < items.length - 1) {
                        setItems((current) => moveItem(current, index, 1));
                      }
                    }}
                  >
                    ↓
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove track ${String(index + 1)}`}
                    onClick={() => {
                      setItems((current) => removeItem(current, index));
                    }}
                  >
                    ✕
                  </GlassButton>
                </div>
                {fullWidth && (
                  <div className="pl-8">
                    <GlassInput
                      aria-label={`Full-width title of track ${String(index + 1)}`}
                      value={item.fullWidthTitle}
                      onChange={(event) => {
                        const fullWidthTitle = event.target.value;
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id ? { ...entry, fullWidthTitle } : entry,
                          ),
                        );
                      }}
                    />
                  </div>
                )}
                <p className="ml-8 flex flex-wrap items-center gap-2 text-xs opacity-80">
                  <span className="[overflow-wrap:anywhere]">{item.file.name}</span>
                  {item.durationSeconds !== null && item.problem === null && (
                    <span>{formatSeconds(item.durationSeconds)}</span>
                  )}
                  {item.durationSeconds === null && <span>Reading…</span>}
                  {item.atrac !== null && (
                    <GlassBadge tone="blue">Already {MODE_LABELS[item.atrac]}</GlassBadge>
                  )}
                  {item.problem !== null && (
                    <GlassBadge tone="orange">
                      Will be skipped: {skipReasonText(item.problem)}
                    </GlassBadge>
                  )}
                </p>
              </li>
            ))}
          </ol>
          <div>
            <GlassButton
              type="button"
              variant="soft"
              size="sm"
              onClick={() => moreInput.current?.click()}
            >
              Add more files
            </GlassButton>
            <input
              ref={moreInput}
              type="file"
              multiple
              accept="audio/*,.oma,.at3,.flac,.m4a,.opus"
              className="hidden"
              onChange={(event) => {
                addFiles([...(event.target.files ?? [])]);
                event.target.value = '';
              }}
            />
          </div>
          {rejected.length > 0 && (
            <p className="text-sm">
              Not audio, so not added: {rejected.map((name) => `“${name}”`).join(', ')}.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <GlassMeter
              label="Time needed on the disc"
              value={fit.neededSeconds}
              max={Math.max(fit.freeSeconds, fit.neededSeconds, 1)}
              valueText={fit.text}
            />
            <p className="text-sm">{fit.text} (in SP time)</p>
            {fit.titlesShortened && (
              <p className="text-sm">
                Some titles do not fit in the disc's title space and will be shortened.
              </p>
            )}
            {fit.reason !== null && (
              <p role="status" className="text-sm font-semibold">
                {fit.reason}
              </p>
            )}
          </div>

          {consentPending && (
            <GlassAlert tone="info" title={`Send your files to ${ONLINE_HOST}?`}>
              <p>
                Sony's encoder runs on {ONLINE_HOST}, a service run by MiniDisc enthusiasts. Your{' '}
                {sentCount === 1 ? 'file is' : `${String(sentCount)} files are`} uploaded there,
                encoded and sent back. Nothing else leaves your computer.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <GlassButton
                  type="button"
                  variant="primary"
                  size="sm"
                  // The list can change while the prompt is open; it starts only what could upload.
                  disabled={!fit.canUpload}
                  onClick={() => {
                    const consented = { ...chosen, onlineConsent: true };
                    onPreferences(consented);
                    upload(consented);
                  }}
                >
                  Send and upload
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAskConsent(false);
                    setEncoder('built-in');
                  }}
                >
                  Use the built-in encoder
                </GlassButton>
              </div>
            </GlassAlert>
          )}

          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="sm"
              disabled={!fit.canUpload || consentPending}
              onClick={() => {
                if (sendsOnline && !preferences.onlineConsent) setAskConsent(true);
                else upload();
              }}
            >
              Upload {uploadCount === 1 ? 'track' : `${String(uploadCount)} tracks`}
            </GlassButton>
          </div>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
