'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { submissionsApi, type SubmissionSummary } from '../api/submissions.api';

const PAGE_SIZE = 10;

type Target = { slug: string; problemSlug: string };

/**
 * The person's own submissions of one problem, newest first, with the best one apart (GRD-112).
 * `refreshKey` changes whenever their latest submission does (a new one, or a result), which starts
 * again from the first page; `loadMore` adds the next page after what is already shown.
 */
export function useMySubmissions(target: Target, enabled: boolean, refreshKey: string) {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [best, setBest] = useState<SubmissionSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    submissionsApi.list(target, { scope: 'mine', page: 1, pageSize: PAGE_SIZE }).then(
      (page) => {
        if (cancelled) return;
        setItems(page.items);
        setBest(page.best ?? null);
        setTotal(page.total);
        setError(null);
        setLoaded(true);
      },
      (caught: unknown) => {
        if (cancelled) return;
        setError(errorMessage(caught));
        setLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, target, refreshKey]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = Math.floor(items.length / PAGE_SIZE) + 1;
      const page = await submissionsApi.list(target, { scope: 'mine', page: next, pageSize: PAGE_SIZE });
      setItems((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setTotal(page.total);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, target]);

  return { items, best, total, loaded, error, loadingMore, loadMore };
}
