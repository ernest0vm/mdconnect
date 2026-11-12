import { useEffect, useRef, useState } from 'react';

import { browserStorage } from '../../browser-storage';
import { InputLostError, openInput } from './capture';
import { startCapture, type LiveCapture } from './capture-source';
import { chooseInput, inputProblem, type AudioInput } from './record-view';
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
    // Nothing to do: the next time starts with the system's default input instead.
  }
}

export interface LiveInput {
  /** The inputs found, or null while they are being listed. */
  readonly inputs: readonly AudioInput[] | null;
  readonly inputId: string | null;
  /** The open capture of the chosen input, or null while it opens or when it cannot be used. */
  readonly capture: LiveCapture | null;
  /** Why the input cannot be used, or null. */
  readonly problem: string | null;
  readonly level: number;
  choose(deviceId: string): void;
  /** Opens the same input once more after it failed or stopped. */
  retry(): void;
  /** Shows a problem found elsewhere, such as a folder that could not be chosen. */
  report(problem: string): void;
  /** Gives the capture to someone else, who closes it; this hook no longer does. */
  handOver(): void;
  /** Takes back a capture that was handed over but not used. */
  takeBack(): void;
}

/**
 * The computer's audio inputs and a live capture of the chosen one, for a level meter and for
 * recording or listening. The input is remembered (the recording and identify dialogs share it),
 * and the capture is closed when the input changes or the component goes away, unless it was
 * handed over.
 */
export function useLiveInput(): LiveInput {
  const [inputs, setInputs] = useState<AudioInput[] | null>(null);
  const [inputId, setInputId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [capture, setCapture] = useState<LiveCapture | null>(null);
  /** Bumped by `retry`, to open the same input once more. */
  const [attempt, setAttempt] = useState(0);
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

  // Opens the chosen input for the level meter; it stays open for the recording or listening.
  useEffect(() => {
    if (inputId === null) return;
    let current = true;
    let opened: LiveCapture | null = null;
    let stopWatchingEnd: () => void = () => undefined;
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
          // An input that stops (unplugged) cannot be used, so the start action goes away with it.
          stopWatchingEnd = live.onEnded(() => {
            setCapture(null);
            setProblem(inputProblem(new InputLostError()));
          });
        },
        (error: unknown) => {
          if (current) setProblem(inputProblem(error));
        },
      );
    return () => {
      current = false;
      stopWatchingEnd();
      setCapture(null);
      if (opened !== null && !handedOver.current) void opened.close();
    };
  }, [inputId, attempt]);

  return {
    inputs,
    inputId,
    capture,
    problem,
    level,
    choose(deviceId) {
      setInputId(deviceId);
      rememberInput(deviceId);
    },
    retry() {
      setProblem(null);
      setAttempt((count) => count + 1);
    },
    report: setProblem,
    handOver() {
      handedOver.current = true;
      if (inputId !== null) rememberInput(inputId);
    },
    takeBack() {
      handedOver.current = false;
    },
  };
}
