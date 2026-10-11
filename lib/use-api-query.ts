'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error };

/**
 * Loads data when `key` changes and exposes reload(). Deliberately tiny: a
 * stale response from a previous key is dropped, nothing is cached.
 * `load` may change every render; only `key` decides when to fetch again.
 */
export function useApiQuery<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ status: 'success', data });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      }
    );
    return () => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency: callers pass inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, reload };
}

export function isUnauthorized(error: Error | undefined): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Like useApiQuery, plus refetch(): fetch again and swap the new data in without
 * going back to "loading". Use it where the page below holds state that a
 * loading screen would throw away (chosen files, an open dialog, typed text).
 */
export function useRefreshableQuery<T>(load: () => Promise<T>, key: string) {
  const query = useApiQuery(load, key);
  const latest = useRef(load);
  const [fresh, setFresh] = useState<{ source: unknown; data: T } | null>(null);

  useEffect(() => {
    latest.current = load;
  });

  const source = query.status === 'success' ? query.data : undefined;
  const refetch = useCallback(async (): Promise<T> => {
    const data = await latest.current();
    setFresh({ source, data });
    return data;
  }, [source]);

  // A newer copy wins until the query itself loads something else.
  if (query.status === 'success' && fresh && fresh.source === query.data) {
    return { ...query, data: fresh.data, refetch };
  }
  return { ...query, refetch };
}
