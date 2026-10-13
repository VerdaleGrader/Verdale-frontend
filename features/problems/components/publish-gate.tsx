'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CircleCheck, CircleDashed, LoaderCircle } from 'lucide-react';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { formatMemory, formatTime } from '@/lib/format';
import { useVerification } from '../hooks/use-verification';
import type { VerificationRun } from '../types';
import { hasMajorDraft } from '../versioning';
import { useProblemWorkspace } from './problem-workspace';

/**
 * Verify and publish for a draft (a first draft or a Major draft): the checklist, the Verify button with live
 * progress, the report, and Publish behind a confirmation. Observers see all of it and can press nothing.
 */
export function PublishGate() {
  const { target, editor, setEditor, refresh } = useProblemWorkspace();
  const { abilities } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const gate = useVerification({ target, editor, setEditor, refresh });
  const [confirming, setConfirming] = useState(false);
  const canAct = abilities.canEditProblems;
  const done = editor.publish_checks.filter((check) => check.ok).length;
  const othersReady = editor.publish_checks.filter((check) => check.key !== 'verified').every((check) => check.ok);
  const verifying = gate.running;
  const open = editor.open_version;
  const draftOverOpen = hasMajorDraft(editor);

  async function publish() {
    const ok = await gate.publish();
    setConfirming(false);
    if (ok) {
      toast({ tone: 'success', title: 'Published', description: 'Solvers can see and submit to this problem now.' });
      router.refresh();
    }
  }

  return (
    <section
      aria-labelledby="publish-heading"
      className="border-border bg-surface flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="publish-heading" className="text-body-strong">
          Before you publish ({done} of {editor.publish_checks.length} ready)
        </h2>
        {canAct && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void gate.start()}
              disabled={verifying || gate.starting || !editor.editable || !othersReady}
            >
              {gate.starting ? 'Starting…' : gate.run ? 'Verify again' : 'Verify'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!editor.can_publish || gate.publishing || verifying}
              onClick={() => setConfirming(true)}
            >
              Publish
            </Button>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {editor.publish_checks.map((check) => (
          <li key={check.key} className="text-small flex items-start gap-2">
            {check.ok ? (
              <CircleCheck className="text-verdict-ac mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-label="Done" />
            ) : (
              <CircleDashed
                className="text-text-muted mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
                aria-label="Still to do"
              />
            )}
            <span className={check.ok ? 'text-text-muted' : undefined}>{check.message}</span>
          </li>
        ))}
      </ul>

      {gate.run && <VerificationReport run={gate.run} running={verifying} />}

      {gate.error && (
        <div role="alert" className="bg-danger-soft text-small rounded-md p-3">
          <p className="text-danger text-body-strong">{gate.error}</p>
          {gate.blocked.length > 0 && (
            <ul className="list-disc pl-5">
              {gate.blocked.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Publish “${editor.version.title}” as ${editor.version.label}?`}
        description={`The statement, limits, testcases and solutions of this version are frozen once it is published. Solvers will see the statement and the sample testcases only.${
          draftOverOpen && open
            ? ` ${editor.version.label} replaces ${open.label}; earlier submissions are kept and marked as sent to an outdated version.`
            : ''
        }`}
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={gate.publishing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void publish()} disabled={gate.publishing}>
              {gate.publishing ? 'Publishing…' : 'Publish'}
            </Button>
          </>
        }
      />
    </section>
  );
}

/** Live progress while a run is open; afterwards the result, the slowest time and peak memory, and every test. */
export function VerificationReport({ run, running }: { run: VerificationRun; running: boolean }) {
  if (running) {
    return (
      <p role="status" aria-live="polite" className="text-small flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />
        {run.status === 'queued' ? 'Waiting for the judge…' : 'Verifying'}: {run.tests_passed ?? 0} of {run.tests_total}{' '}
        tests passed so far. Editing is paused until it finishes.
      </p>
    );
  }
  const measured = (
    <>
      Slowest test {run.max_time_ms === null ? '–' : formatTime(run.max_time_ms)}, peak memory{' '}
      {run.max_memory_kb === null ? '–' : formatMemory(run.max_memory_kb)}. Use them to choose the limits.
    </>
  );
  return (
    <div className="flex flex-col gap-3" aria-label="Verification report" role="group">
      {run.status === 'passed' ? (
        run.valid ? (
          <Banner tone="brand" title={`Verified: all ${run.tests_total} tests passed`}>
            {measured}
          </Banner>
        ) : (
          <Banner tone="warning" title="Verified, but the content changed since">
            The tests, reference solutions, limits or languages changed after this run. Verify again to publish.
          </Banner>
        )
      ) : (
        <Banner tone="danger" title={run.status === 'error' ? 'Verification could not finish' : 'Verification failed'}>
          {run.reason ?? 'The reference solution did not pass every test.'}{' '}
          {run.verdict && <VerdictBadge verdict={run.verdict} />} {run.results.length > 0 && measured}
        </Banner>
      )}
      {run.results.length > 0 && (
        <div className="vd-tablewrap">
          <table className="vd-table">
            <caption className="vd-sr">Result of every testcase</caption>
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Verdict</th>
                <th scope="col" className="is-num">
                  Time
                </th>
                <th scope="col" className="is-num">
                  Memory
                </th>
              </tr>
            </thead>
            <tbody>
              {run.results.map((result) => (
                <tr key={result.position}>
                  <td>
                    <span className="vd-inline">
                      Test {result.position}
                      <Badge tone={result.is_sample ? 'info' : 'neutral'}>
                        {result.is_sample ? 'Sample' : 'Hidden'}
                      </Badge>
                    </span>
                  </td>
                  <td>
                    <VerdictBadge verdict={result.verdict} format="auto" />
                  </td>
                  <td className="is-num vd-mono">{result.time_ms === null ? '–' : formatTime(result.time_ms)}</td>
                  <td className="is-num vd-mono">{result.memory_kb === null ? '–' : formatMemory(result.memory_kb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
