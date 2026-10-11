'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState =
  | { kind: 'saved'; at: Date | null }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

/**
 * Saves a value shortly after it stops changing (GRD-28).
 *
 *  - `dirty` becomes true as soon as `value` differs from what was last saved.
 *  - The save runs `delayMs` after the last change; `saveNow()` runs it at once.
 *  - A save that fails leaves the value dirty and shows the message; the next
 *    change (or "Try again") retries.
 *  - Closing the tab or reloading while there is unsaved work asks first, and
 *    leaving the editor page tries one last save.
 */
export function useAutosave<T>({
  value,
  saved,
  save,
  delayMs = 1500,
  enabled = true,
  isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b),
}: {
  value: T;
  /** What the server has now. */
  saved: T;
  /** Resolves when stored; rejects with an Error whose message is shown. */
  save: (value: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
  isEqual?: (a: T, b: T) => boolean;
}) {
  const [state, setState] = useState<SaveState>({ kind: 'saved', at: null });
  const latest = useRef({ value, saved, save, enabled, isEqual });
  const inFlight = useRef<Promise<void> | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    latest.current = { value, saved, save, enabled, isEqual };
  });

  const dirty = enabled && !isEqual(value, saved);

  const run = useCallback(async () => {
    if (inFlight.current) {
      await inFlight.current.catch(() => undefined);
    }
    const { value: current, saved: base, save: doSave, enabled: on, isEqual: same } = latest.current;
    if (!on || same(current, base)) return;
    setState({ kind: 'saving' });
    const attempt = doSave(current).then(
      () => {
        failed.current = false;
        setState({ kind: 'saved', at: new Date() });
      },
      (error: unknown) => {
        failed.current = true;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save.' });
      }
    );
    inFlight.current = attempt;
    await attempt;
    inFlight.current = null;
  }, []);

  // Debounced save after every change.
  useEffect(() => {
    if (!dirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the value just edited
    setState((previous) => (previous.kind === 'saving' ? previous : { kind: 'dirty' }));
    const timer = window.setTimeout(() => void run(), delayMs);
    return () => window.clearTimeout(timer);
  }, [dirty, value, delayMs, run]);

  // Warn before closing the tab with work that is not saved.
  const pending = dirty || state.kind === 'saving';
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  // One last try when the person leaves the page (switching tabs, closing).
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') void run();
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      void run();
    };
  }, [run]);

  return { state, dirty, saveNow: run };
}

/** "Saved", "Saving…", "Unsaved changes", or the error, for the status line next to the editor. */
export function saveStateLabel(state: SaveState, dirty: boolean): string {
  if (state.kind === 'saving') return 'Saving…';
  if (state.kind === 'error') return `Not saved: ${state.message}`;
  if (dirty || state.kind === 'dirty') return 'Unsaved changes';
  return state.at
    ? `Saved at ${state.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'All changes saved';
}
