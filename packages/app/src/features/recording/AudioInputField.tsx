import { GlassAlert } from '@mdconnect/ui/components/glassyui/glass-alert';
import { GlassButton } from '@mdconnect/ui/components/glassyui/glass-button';
import { GlassMeter } from '@mdconnect/ui/components/glassyui/glass-meter';
import { useId } from 'react';

import { percentText } from '../../percent';
import type { LiveInput } from './useLiveInput';

/** The audio input list, its level meter, and why it cannot be used, with Try again. */
export function AudioInputField({
  live,
  locked,
}: {
  readonly live: LiveInput;
  /** True while the capture is in use, when changing the input would pull it away. */
  readonly locked: boolean;
}) {
  const selectId = useId();
  const { inputs, inputId, level, problem } = live;
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm font-semibold">
          Audio input
        </label>
        <select
          id={selectId}
          className="rounded-lg border border-[var(--lg-border)] bg-[var(--lg-control-surface)] px-2 py-1.5 text-sm"
          value={inputId ?? ''}
          disabled={inputs === null || inputs.length === 0 || locked}
          onChange={(event) => {
            live.choose(event.target.value);
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
          {inputId !== null && (
            <GlassButton
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              disabled={locked}
              onClick={() => {
                live.retry();
              }}
            >
              Try again
            </GlassButton>
          )}
        </GlassAlert>
      )}
    </>
  );
}
