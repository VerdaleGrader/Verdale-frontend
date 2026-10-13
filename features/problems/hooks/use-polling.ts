'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `tick` every `intervalMs` while `enabled`, one call at a time (the next wait starts when the
 * previous call has finished). Stops when `enabled` turns false and when the component unmounts.
 */
export function usePolling(tick: () => Promise<void>, enabled: boolean, intervalMs = 2000) {
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        try {
          await latest.current();
        } catch {
          /* a failed poll is tried again at the next beat */
        }
        if (!stopped) schedule();
      }, intervalMs);
    };
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [enabled, intervalMs]);
}
