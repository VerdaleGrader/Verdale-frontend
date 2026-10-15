'use client';

import { useCallback, useEffect, useState } from 'react';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import { isRunning } from '../ai-tests';
import type { AiTestJob } from '../types';

const POLL_MS = 1500;
const MAX_POLL_FAILURES = 3;

const storageKey = (target: ProblemTarget) => `verdale-ai-tests-${target.slug}-${target.problemSlug}`;

function remember(target: ProblemTarget, job: AiTestJob | null) {
  try {
    if (job && isRunning(job)) window.sessionStorage.setItem(storageKey(target), job.id);
    else window.sessionStorage.removeItem(storageKey(target));
  } catch {
    /* private mode: the job is simply not picked up again after a reload */
  }
}

/**
 * Starts an AI testcase job and follows it until it ends. A running job is picked up again when the dialog is opened
 * again or the page is reloaded (Core keeps it for 24 hours). A job that already ended is not brought back: its
 * drafts are for the session that asked for them.
 */
export function useAiTests(target: ProblemTarget) {
  const [job, setJob] = useState<AiTestJob | null>(null);
  const [pollFailures, setPollFailures] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let savedId: string | null = null;
    try {
      savedId = window.sessionStorage.getItem(storageKey(target));
    } catch {
      savedId = null;
    }
    if (!savedId) return;
    problemsApi.aiTestJob(target, savedId).then(
      (found) => {
        if (cancelled) return;
        if (isRunning(found)) setJob(found);
        else remember(target, null);
      },
      () => remember(target, null)
    );
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!job) return;
    if (!isRunning(job)) {
      remember(target, null);
      return;
    }
    if (pollFailures >= MAX_POLL_FAILURES) return;
    const timer = setTimeout(async () => {
      try {
        const next = await problemsApi.aiTestJob(target, job.id);
        setPollFailures(0);
        setJob((current) => (current && current.id === next.id ? next : current));
      } catch {
        setPollFailures((count) => count + 1);
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [job, pollFailures, target]);

  const start = useCallback(
    async (body: Parameters<typeof problemsApi.startAiTests>[1]) => {
      const started = await problemsApi.startAiTests(target, body);
      remember(target, started);
      setPollFailures(0);
      setJob(started);
    },
    [target]
  );

  return {
    job,
    start,
    clear: useCallback(() => {
      remember(target, null);
      setJob(null);
    }, [target]),
    /** Polling gave up after repeated failures; the job may still be running. */
    lostContact: job !== null && isRunning(job) && pollFailures >= MAX_POLL_FAILURES,
    pollAgain: useCallback(() => setPollFailures(0), []),
  };
}
