import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassCheckbox } from '@mdconnect/ui/components/glassyui/glass-checkbox';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
  GlassDialogTrigger,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { useId, useRef, type ReactNode } from 'react';

import { AppearanceSection } from '../appearance/AppearanceSection';
import type { Encoder, RecordingMode } from '../upload/convert-track';
import type { TitleSource } from '../upload/title-source';
import { withdrawConsent } from '../upload/upload-preferences';
import { useUploadPreferences } from '../upload/UploadPreferencesContext';
import {
  ENCODER_LABELS,
  ENCODERS,
  MODE_LABELS,
  RECORDING_MODES,
  TITLE_SOURCE_LABELS,
} from '../upload/upload-view';
import {
  RECOGNITION_SERVICES,
  withdrawRecognitionConsent,
} from '../recognition/recognition-preferences';
import { useRecognitionPreferences } from '../recognition/RecognitionPreferencesContext';
import {
  consentStatus,
  recognitionConsentStatus,
  saveFailedText,
  SETTINGS_SECTIONS,
  withdrawLabel,
} from './settings-view';

const [APPEARANCE, TITLES, UPLOADS, RECOGNITION] = SETTINGS_SECTIONS;

const selectClass =
  'rounded-lg border border-[var(--lg-border)] bg-[var(--lg-control-surface)] px-2 py-1.5 text-sm';

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-base font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A labelled native select, so the keyboard and screen readers work as everywhere else. */
function Select<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs opacity-80">
          {hint}
        </p>
      )}
    </div>
  );
}

function TitlesSection() {
  const { preferences, setPreferences } = useUploadPreferences();
  const hint = useId();
  return (
    <Section title={TITLES}>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <GlassCheckbox
            checked={preferences.fullWidth}
            aria-describedby={hint}
            onChange={() => {
              setPreferences({ ...preferences, fullWidth: !preferences.fullWidth });
            }}
          />
          Full-width titles
        </label>
        <p id={hint} className="text-xs opacity-80">
          Shows the full-width (Japanese) title fields when renaming and adding tracks. Full-width
          titles already on a disc are kept either way.
        </p>
      </div>
    </Section>
  );
}

function UploadsSection() {
  const { preferences, setPreferences } = useUploadPreferences();
  const consent = consentStatus(preferences);
  const consentText = useRef<HTMLParagraphElement>(null);
  return (
    <Section title={UPLOADS}>
      <p className="text-sm opacity-80">The Add tracks dialog starts with these choices.</p>
      <Select<RecordingMode>
        label="Recording mode"
        hint="Decks that cannot record SP mono use SP."
        value={preferences.mode}
        options={RECORDING_MODES.map((value) => ({ value, label: MODE_LABELS[value] }))}
        onChange={(mode) => {
          setPreferences({ ...preferences, mode });
        }}
      />
      <Select<TitleSource>
        label="Track titles from"
        value={preferences.titleSource}
        options={Object.entries(TITLE_SOURCE_LABELS).map(([value, label]) => ({
          value: value as TitleSource,
          label,
        }))}
        onChange={(titleSource) => {
          setPreferences({ ...preferences, titleSource });
        }}
      />
      <Select<Encoder>
        label="LP encoder"
        value={preferences.encoder}
        options={ENCODERS.map((value) => ({ value, label: ENCODER_LABELS[value] }))}
        onChange={(encoder) => {
          setPreferences({ ...preferences, encoder });
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <GlassCheckbox
          checked={preferences.replayGain}
          onChange={() => {
            setPreferences({ ...preferences, replayGain: !preferences.replayGain });
          }}
        />
        Use ReplayGain
      </label>
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm font-semibold">Online encoder</p>
        <p ref={consentText} tabIndex={-1} className="text-sm outline-none" aria-live="polite">
          {consent.text}
        </p>
        {consent.canWithdraw && (
          <GlassButton
            type="button"
            variant="soft"
            size="sm"
            onClick={() => {
              setPreferences(withdrawConsent(preferences));
              // The button goes away with the consent; keep focus in the dialog, on the new status.
              consentText.current?.focus();
            }}
          >
            Withdraw consent
          </GlassButton>
        )}
      </div>
    </Section>
  );
}

/** The consent given to each recognition service, each with its own withdraw action. */
function RecognitionSection() {
  const { preferences, setPreferences } = useRecognitionPreferences();
  const status = useRef<HTMLDivElement>(null);
  return (
    <Section title={RECOGNITION}>
      <p className="text-sm opacity-80">
        Identify asks before it first sends data to each of these services.
      </p>
      <div ref={status} tabIndex={-1} className="flex flex-col items-start gap-2 outline-none">
        {RECOGNITION_SERVICES.map((service) => {
          const consent = recognitionConsentStatus(preferences, service);
          return (
            <div key={service} className="flex flex-col items-start gap-1">
              <p className="text-sm" aria-live="polite">
                {consent.text}
              </p>
              {consent.canWithdraw && (
                <GlassButton
                  type="button"
                  variant="soft"
                  size="sm"
                  aria-label={withdrawLabel(service)}
                  onClick={() => {
                    setPreferences(withdrawRecognitionConsent(preferences, service));
                    // The button goes away with the consent; keep focus in the section.
                    status.current?.focus();
                  }}
                >
                  Withdraw consent
                </GlassButton>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** The header's Settings control: its sections, applied as they change. */
export function SettingsDialog() {
  const { saved: uploadsSaved } = useUploadPreferences();
  const { saved: recognitionSaved } = useRecognitionPreferences();
  const saveProblem = saveFailedText({ uploads: uploadsSaved, recognition: recognitionSaved });
  return (
    <GlassDialog>
      {/* The trigger is where Radix returns focus when the dialog closes. */}
      <GlassDialogTrigger asChild>
        <GlassButton variant="ghost" size="sm">
          Settings
        </GlassButton>
      </GlassDialogTrigger>
      <GlassDialogContent
        closeLabel="Close"
        onOpenAutoFocus={(event) => {
          // Start on the checked Appearance option, as a radio group does, not on the first one.
          const checked = (
            event.currentTarget as HTMLElement | null
          )?.querySelector<HTMLInputElement>('input[type="radio"]:checked');
          if (checked) {
            event.preventDefault();
            checked.focus();
          }
        }}
      >
        <GlassDialogTitle className="text-lg font-semibold">Settings</GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          Changes apply right away and are remembered on this device.
        </GlassDialogDescription>
        {saveProblem !== null && (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-800 dark:text-red-200">
            {saveProblem}
          </p>
        )}
        {/* Only the sections scroll, so the title and the close button stay in view. */}
        <div className="mt-4 -mr-2 flex max-h-[calc(100dvh-12rem)] flex-col gap-6 overflow-y-auto pr-2">
          <Section title={APPEARANCE}>
            <AppearanceSection />
          </Section>
          <TitlesSection />
          <UploadsSection />
          <RecognitionSection />
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
