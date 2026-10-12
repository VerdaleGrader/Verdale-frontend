'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import type { GenerateJob } from '../types';

/** A Generate job and what the page needs to describe it. */
export interface GenerateRunState {
  job: GenerateJob;
  solutionId: string;
  /** "Solution 1 (C++)" */
  solutionLabel: string;
  /** Saved testcases the person chose not to regenerate: they keep their output. */
  kept: string[];
  /** The testcase ids the job was asked to run. */
  requested: string[];
}

const POLL_MS = 1500;
const MAX_POLL_FAILURES = 3;

const storageKey = (target: ProblemTarget) => `verdale-generate-${target.slug}-${target.problemSlug}`;

function remember(target: ProblemTarget, run: GenerateRunState | null) {
  try {
    if (run && run.job.status === 'running') {
      window.sessionStorage.setItem(
        storageKey(target),
        JSON.stringify({
          id: run.job.id,
          solutionId: run.solutionId,
          solutionLabel: run.solutionLabel,
          kept: run.kept,
          requested: run.requested,
        })
      );
    } else window.sessionStorage.removeItem(storageKey(target));
  } catch {
    /* private mode: the job simply is not picked up again after a reload */
  }
}

/**
 * Starts a Generate job, follows it until it ends and lets the person stop it. A running job is picked up again
 * after a reload of the page (Core keeps it for 24 hours). `onFinished` is called once per job when it leaves `running`.
 */
export function useGenerate(target: ProblemTarget, onFinished: (run: GenerateRunState) => void) {
  const [run, setRun] = useState<GenerateRunState | null>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const reported = useRef<string | null>(null);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  // Pick up a job that was running when the page was left.
  useEffect(() => {
    let cancelled = false;
    let saved: { id: string; solutionId: string; solutionLabel: string; kept: string[]; requested: string[] } | null =
      null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(storageKey(target)) ?? 'null');
    } catch {
      saved = null;
    }
    if (!saved) return;
    const { id, ...rest } = saved;
    problemsApi.generateJob(target, id).then(
      (job) => {
        if (!cancelled && job.status === 'running') setRun({ job, ...rest });
        else remember(target, null);
      },
      () => remember(target, null)
    );
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!run) return;
    const { job } = run;
    if (job.status !== 'running') {
      remember(target, null);
      if (reported.current !== job.id) {
        reported.current = job.id;
        finished.current(run);
      }
      return;
    }
    if (pollFailures >= MAX_POLL_FAILURES) return;
    const timer = setTimeout(async () => {
      try {
        const next = await problemsApi.generateJob(target, job.id);
        setPollFailures(0);
        setRun((current) => (current && current.job.id === next.id ? { ...current, job: next } : current));
      } catch {
        setPollFailures((count) => count + 1);
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [run, pollFailures, target]);

  const start = useCallback(
    async (solutionId: string, solutionLabel: string, testIds: string[], kept: string[]) => {
      const job = await problemsApi.startGenerate(target, { solution_id: solutionId, test_ids: testIds });
      const next = { job, solutionId, solutionLabel, kept, requested: testIds };
      remember(target, next);
      setPollFailures(0);
      setRun(next);
    },
    [target]
  );

  const stop = useCallback(async () => {
    if (!run) return;
    const job = await problemsApi.stopGenerate(target, run.job.id);
    setRun((current) => (current && current.job.id === job.id ? { ...current, job } : current));
  }, [run, target]);

  return {
    run,
    start,
    stop,
    clear: useCallback(() => {
      remember(target, null);
      setRun(null);
    }, [target]),
    /** Polling gave up after repeated failures; the job may still be running. */
    lostContact: run?.job.status === 'running' && pollFailures >= MAX_POLL_FAILURES,
    pollAgain: useCallback(() => setPollFailures(0), []),
  };
}
