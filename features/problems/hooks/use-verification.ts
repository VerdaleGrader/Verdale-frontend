'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import type { ProblemEditor, VerificationRun } from '../types';
import { versionErrorMessage } from '../versioning';
import { usePolling } from './use-polling';

export const POLL_MS = 2000;

export const isRunning = (run: VerificationRun | null | undefined) =>
  run?.status === 'queued' || run?.status === 'running';

/**
 * Verify and publish for the draft in the workspace: starts a run, polls it about every 2 s while it is queued or
 * running, and asks the workspace to load the editor again when it finishes (the version status, the checklist and
 * `can_publish` come from Core). Polling stops on unmount and when the run ends.
 */
export function useVerification({
  target,
  editor,
  setEditor,
  refresh,
}: {
  target: ProblemTarget;
  editor: ProblemEditor;
  setEditor: (next: ProblemEditor) => void;
  refresh: () => Promise<void>;
}) {
  const [local, setLocal] = useState<{ source: VerificationRun | null; run: VerificationRun } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);

  // A run we started or polled wins over the editor's copy until the editor itself carries a different run.
  const run = local && local.source === editor.verification ? local.run : editor.verification;
  const running = isRunning(run) || editor.version.status === 'verifying';

  usePolling(
    async () => {
      let next: VerificationRun;
      try {
        next = await problemsApi.verification(target);
      } catch (caught) {
        // Nothing to show yet (the run was not stored): the next beat asks again.
        if (caught instanceof ApiError && caught.errorCode === 'NO_VERIFICATION') return;
        throw caught;
      }
      setLocal({ source: editor.verification, run: next });
      if (!isRunning(next)) await refresh();
    },
    running,
    POLL_MS
  );

  async function start() {
    setStarting(true);
    setError(null);
    setBlocked([]);
    try {
      const started = await problemsApi.verify(target);
      setLocal({ source: editor.verification, run: started });
      await refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.errorCode === 'VERIFY_BLOCKED') {
        setBlocked((caught.details ?? []).map((detail) => detail.message));
      }
      setError(versionErrorMessage(caught));
      if (caught instanceof ApiError && caught.errorCode === 'VERIFY_IN_PROGRESS') await refresh();
    } finally {
      setStarting(false);
    }
  }

  async function publish(): Promise<boolean> {
    setPublishing(true);
    setError(null);
    setBlocked([]);
    try {
      setEditor(await problemsApi.publish(target));
      return true;
    } catch (caught) {
      if (caught instanceof ApiError && caught.errorCode === 'PUBLISH_BLOCKED') {
        setBlocked((caught.details ?? []).map((detail) => detail.message));
      }
      setError(versionErrorMessage(caught));
      return false;
    } finally {
      setPublishing(false);
    }
  }

  return { run, running, starting, publishing, error, blocked, start, publish };
}
