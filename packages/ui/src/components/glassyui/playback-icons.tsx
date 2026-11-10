/** Playback icons. Decorative: the buttons that use them carry the text labels. */

const ICON = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
} as const;

export function PlayIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 3.5h9v9h-9z" />
    </svg>
  );
}

export function PreviousIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 2.5h2v11H3zM13 2.5v11L5.5 8z" />
    </svg>
  );
}

export function NextIcon() {
  return (
    <svg {...ICON}>
      <path d="M11 2.5h2v11h-2zM3 2.5v11L10.5 8z" />
    </svg>
  );
}
