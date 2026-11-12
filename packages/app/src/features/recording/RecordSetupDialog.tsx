import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
} from '@mdconnect/ui/components/glassyui/glass-dialog';
import { GlassMeter } from '@mdconnect/ui/components/glassyui/glass-meter';
import { useEffect, useId, useRef, useState } from 'react';

import { browserStorage } from '../../browser-storage';
import { percentText } from '../../percent';
import { openInput } from './capture';
import { startCapture, type LiveCapture } from './capture-source';
import {
  chooseInput,
  FOLDER_PROBLEM,
  inputProblem,
  longTrackWarning,
  type AudioInput,
} from './record-view';
import type { RecordingTrack } from './session';
import { useInputLevel } from './useInputLevel';

const INPUT_KEY = 'mdconnect.recordInput';

/** The computer's audio inputs, asking for permission first so the browser gives their names. */
async function listInputs(): Promise<AudioInput[]> {
  const list = async () =>
    (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({ deviceId: device.deviceId, label: device.label }));
  const first = await list();
  if (first.length === 0 || first.every((input) => input.label !== '')) return first;
  const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of probe.getTracks()) track.stop();
  return list();
}

/** Remembers the input for next time; a profile that blocks storage just forgets it. */
function rememberInput(deviceId: string): void {
  try {
    browserStorage()?.setItem(INPUT_KEY, deviceId);
  } catch {
    // Nothing to do: the next recording starts with the first input instead.
  }
}

/**
 * Explains the cabling, lets the user pick the audio input and watch its level, and hands the
 * open capture to the recording when the user starts it.
 */
export function RecordSetupDialog({
  tracks,
  onStart,
  onClose,
  returnFocus,
}: {
  readonly tracks: readonly RecordingTrack[];
  /** Called with the open capture; it then belongs to the recording. */
  readonly onStart: (capture: LiveCapture) => Promise<boolean>;
  readonly onClose: () => void;
  /** Where focus goes when the dialog closes: the control that opened it. */
  readonly returnFocus?: () => HTMLElement | null;
}) {
  const selectId = useId();
  const [inputs, setInputs] = useState<AudioInput[] | null>(null);
  const [inputId, setInputId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [capture, setCapture] = useState<LiveCapture | null>(null);
  const [starting, setStarting] = useState(false);
  const handedOver = useRef(false);
  const level = useInputLevel(capture);

  useEffect(() => {
    let current = true;
    listInputs().then(
      (found) => {
        if (!current) return;
        setInputs(found);
        setInputId(chooseInput(found, browserStorage()?.getItem(INPUT_KEY) ?? null));
        if (found.length === 0) setProblem(inputProblem(new DOMException('', 'NotFoundError')));
      },
      (error: unknown) => {
        if (!current) return;
        setInputs([]);
        setProblem(inputProblem(error));
      },
    );
    return () => {
      current = false;
    };
  }, []);

  // Opens the chosen input for the level meter; it stays open for the recording.
  useEffect(() => {
    if (inputId === null) return;
    let current = true;
    let opened: LiveCapture | null = null;
    openInput(navigator.mediaDevices, inputId)
      .then(startCapture)
      .then(
        (live) => {
          opened = live;
          if (!current) {
            void live.close();
            return;
          }
          setProblem(null);
          setCapture(live);
        },
        (error: unknown) => {
          if (current) setProblem(inputProblem(error));
        },
      );
    return () => {
      current = false;
      setCapture(null);
      if (opened !== null && !handedOver.current) void opened.close();
    };
  }, [inputId]);

  const warning = longTrackWarning(tracks);
  const count = tracks.length;
  return (
    <GlassDialog
      open
      onOpenChange={(open) => {
        if (!open && !starting) onClose();
      }}
    >
      <GlassDialogContent closeLabel="Cancel" className="max-w-xl" returnFocus={returnFocus}>
        <GlassDialogTitle className="text-lg font-semibold">
          Record {count === 1 ? 'track' : `${String(count)} tracks`}
        </GlassDialogTitle>
        <GlassDialogDescription className="mt-1 text-sm opacity-80">
          The deck plays each track while mdconnect records it, so this takes as long as the tracks
          last.
        </GlassDialogDescription>
        <ol className="mt-4 flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>Connect the deck’s line-out or headphone output to the computer’s audio input.</li>
          <li>Choose that input below.</li>
          <li>
            Play a track on the deck and set its volume and the input gain so the level stays below
            full.
          </li>
        </ol>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={selectId} className="text-sm font-semibold">
              Audio input
            </label>
            <select
              id={selectId}
              className="rounded-lg border border-[var(--lg-border)] bg-[var(--lg-control-surface)] px-2 py-1.5 text-sm"
              value={inputId ?? ''}
              disabled={inputs === null || inputs.length === 0}
              onChange={(event) => {
                setInputId(event.target.value);
                rememberInput(event.target.value);
              }}
            >
              {inputs === null && <option value="">Looking for inputs…</option>}
              {inputs?.length === 0 && <option value="">No input available</option>}
              {(inputs ?? []).map((input) => (
                <option key={input.deviceId} value={input.deviceId}>
                  {input.label || 'Audio input'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm">Input level</p>
            <GlassMeter label="Input level" value={level} max={1} valueText={percentText(level)} />
          </div>
          {problem !== null && (
            <GlassAlert tone="warning" title="The input cannot be used">
              <p>{problem}</p>
            </GlassAlert>
          )}
          {warning !== null && <p className="text-sm">{warning}</p>}
          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              size="sm"
              disabled={capture === null || starting}
              onClick={() => {
                if (capture === null) return;
                if (inputId !== null) rememberInput(inputId);
                setStarting(true);
                handedOver.current = true;
                const keepSetup = () => {
                  handedOver.current = false;
                  setStarting(false);
                };
                onStart(capture).then(
                  (started) => {
                    // A cancelled folder picker leaves the setup open with the input still live.
                    if (!started) keepSetup();
                  },
                  (error: unknown) => {
                    console.error('mdconnect: the recording could not start', error);
                    keepSetup();
                    setProblem(FOLDER_PROBLEM);
                  },
                );
              }}
            >
              Start recording
            </GlassButton>
          </div>
        </div>
      </GlassDialogContent>
    </GlassDialog>
  );
}
