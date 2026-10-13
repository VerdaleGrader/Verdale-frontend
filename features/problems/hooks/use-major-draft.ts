'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import type { ProblemEditor } from '../types';
import { versionErrorMessage } from '../versioning';

/** Start a Major draft of a published problem (to change tests and solutions) or throw the open one away. */
export function useMajorDraft({
  target,
  setEditor,
  refresh,
}: {
  target: ProblemTarget;
  setEditor: (next: ProblemEditor) => void;
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(call: () => Promise<ProblemEditor>, success: (next: ProblemEditor) => string, failure: string) {
    setBusy(true);
    try {
      const next = await call();
      setEditor(next);
      toast({ tone: 'success', title: success(next) });
      return true;
    } catch (caught) {
      toast({ tone: 'danger', title: failure, description: versionErrorMessage(caught) });
      await refresh(); // DRAFT_EXISTS / NO_DRAFT mean the page was out of date
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    start: () =>
      run(
        () => problemsApi.createMajorDraft(target),
        (next) => `Major draft ${next.version.label} started`,
        'Could not start a Major draft'
      ),
    discard: () =>
      run(
        () => problemsApi.discardMajorDraft(target),
        () => 'Draft discarded',
        'Could not discard the draft'
      ),
  };
}
