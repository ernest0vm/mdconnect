import { useEffect, useState } from 'react';

import { blockPeak, type BlockSource } from './capture';

const REFRESH_MS = 100;
/** How much of the shown level is kept each refresh, so peaks fall back smoothly. */
const DECAY = 0.7;

/** The input's peak level for a meter, from 0 to 1, refreshed about ten times a second. */
export function useInputLevel(source: BlockSource | null): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (source === null) return;
    let peak = 0;
    let shown = 0;
    const stop = source.onBlock((block) => {
      peak = Math.max(peak, blockPeak(block));
    });
    const timer = setInterval(() => {
      shown = Math.max(Math.min(peak, 1), shown * DECAY);
      peak = 0;
      setLevel(shown);
    }, REFRESH_MS);
    return () => {
      stop();
      clearInterval(timer);
      setLevel(0);
    };
  }, [source]);
  return level;
}
