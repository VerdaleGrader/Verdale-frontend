'use client';

import Link from 'next/link';
import { RotateCcw, X } from 'lucide-react';
import { TestProgress } from '@/components/grader/test-progress';
import type { Verdict } from '@/components/grader/verdict';

import { Banner } from '@/components/ui/banner';
import { Button, buttonVariants } from '@/components/ui/button';
import type { GenerateRun } from '../types';
import type { GenerateRunState } from '../hooks/use-generate';

const FAILURE_VERDICTS = ['TLE', 'MLE', 'RE', 'OLE', 'ISE'] as const;

/** The verdict a failed run is shown with; anything Core does not name as a verdict is an internal error. */
export function failureVerdict(run: { verdict: string | null }): Verdict {
  return (FAILURE_VERDICTS as readonly string[]).includes(run.verdict ?? '') ? (run.verdict as Verdict) : 'ISE';
}

const HAPPENED: Record<string, string> = {
  TLE: 'hit the time limit',
  MLE: 'ran out of memory',
  RE: 'crashed',
  OLE: 'printed too much',
  ISE: 'hit an internal error',
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function cellOf(run: GenerateRun): Verdict {
  if (run.status === 'queued') return 'QUEUED';
  if (run.status === 'running') return 'RUNNING';
  if (run.status === 'done') return 'AC';
  return failureVerdict(run);
}

/** The panel above the list while a job runs: progress, the Stop button, and what to expect. */
export function GenerateProgress({
  state,
  testCount,
  onStop,
  lostContact,
  onPollAgain,
}: {
  state: GenerateRunState;
  testCount: number;
  onStop: () => void;
  lostContact: boolean;
  onPollAgain: () => void;
}) {
  const { job } = state;
  const running = job.runs.find((run) => run.status === 'running');
  const label = running
    ? `Running testcase ${running.position} of ${testCount}`
    : job.progress.done + job.progress.failed >= job.progress.total
      ? 'Finishing up'
      : 'Waiting for the judge';
  return (
    <div role="region" aria-labelledby="generate-title" className="tc-panel">
      <div className="tc-panel__head">
        <div>
          <h3 className="tc-h3" id="generate-title">
            Generating expected output
          </h3>
          <p className="tc-sub">
            {state.solutionLabel} · {plural(job.progress.total, 'testcase')} to run
            {state.kept.length > 0 ? `, ${state.kept.length} kept` : ''}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onStop}>
          <X aria-hidden />
          Stop
        </Button>
      </div>
      <TestProgress results={job.runs.map(cellOf)} label={label} ariaLabel="Generation progress" />
      {lostContact ? (
        <div className="mt-3">
          <Banner
            tone="warning"
            title="Lost contact with the server"
            action={
              <Button size="sm" onClick={onPollAgain}>
                Check again
              </Button>
            }
          >
            The job may still be running. Your results are kept for 24 hours.
          </Banner>
        </div>
      ) : (
        <p className="tc-sub" style={{ marginTop: 12 }}>
          The list is locked until this finishes. Results come back as unsaved changes for you to review. You can leave
          the page and come back; Stop keeps what already finished.
        </p>
      )}
    </div>
  );
}

/** What a finished job produced, from the runs and the way the job ended. */
export function summarize(state: GenerateRunState) {
  const { job } = state;
  const done = job.runs.filter((run) => run.status === 'done' && run.output);
  const failed = job.runs.filter((run) => run.status === 'failed');
  const open = job.runs.filter((run) => run.status === 'queued' || run.status === 'running');
  return {
    done,
    failed,
    open,
    changed: done.filter((run) => run.same_as_current === false),
    same: done.filter((run) => run.same_as_current === true),
    created: done.filter((run) => run.same_as_current === null),
    /** The testcases that did not come out, to run again. */
    retry: job.runs.filter((run) => run.status !== 'done').map((run) => run.test_id),
  };
}

/** How a finished job is reported above the list. */
export function GenerateOutcome({
  state,
  baseHref,
  reviewed,
  onReview,
  onRetry,
  onChooseAnother,
  onDiscard,
  onDismiss,
}: {
  state: GenerateRunState;
  /** `/spaces/<slug>/problems/<problem>/edit`, for the link to the Solutions tab. */
  baseHref: string;
  reviewed: boolean;
  onReview: () => void;
  onRetry: (testIds: string[]) => void;
  onChooseAnother: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}) {
  const { job, solutionLabel } = state;
  const summary = summarize(state);
  const got = summary.done.length;
  const requested = job.progress.total;
  const rest = requested - got;
  const discard = (
    <Button size="sm" variant="ghost" onClick={onDiscard}>
      <RotateCcw aria-hidden />
      Discard generated outputs
    </Button>
  );

  if (job.status === 'failed' && job.error?.code === 'COMPILE_ERROR') {
    return (
      <Banner
        tone="danger"
        title={`Couldn't generate: ${solutionLabel} didn't compile`}
        action={
          <>
            <Link href={`${baseHref}/solutions`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Open Solutions
            </Link>
            <Button size="sm" onClick={onChooseAnother}>
              Choose another solution
            </Button>
          </>
        }
      >
        No testcase was run and nothing changed. First error: <code className="tc-code">{job.error.message}</code>
      </Banner>
    );
  }

  if ((job.status === 'failed' || job.status === 'timed_out') && !reviewed) {
    const timedOut = job.status === 'timed_out';
    const judgeDown =
      job.error?.code === 'JUDGE_UNAVAILABLE' || summary.failed.some((run) => run.error_code === 'JUDGE_UNAVAILABLE');
    const minutes = Math.max(1, Math.round((Date.parse(job.deadline_at) - Date.parse(job.created_at)) / 60000));
    const title = timedOut
      ? `Generation timed out after ${plural(minutes, 'minute')}`
      : judgeDown
        ? "The judge isn't responding"
        : "Couldn't finish generating";
    const lead = timedOut
      ? ''
      : judgeDown
        ? 'This is a problem on our side, not with your solution. '
        : job.error
          ? `${job.error.message} `
          : '';
    return (
      <Banner
        tone={timedOut ? 'warning' : 'danger'}
        title={title}
        action={
          <>
            {got > 0 && (
              <Button size="sm" variant="ghost" onClick={onReview}>
                Review the {got} generated
              </Button>
            )}
            {rest > 0 && (
              <Button size="sm" onClick={() => onRetry(summary.retry)}>
                <RotateCcw aria-hidden />
                Try the {rest} again
              </Button>
            )}
          </>
        }
      >
        {lead}
        {got} of {requested} outputs {got === 1 ? 'was' : 'were'} generated
        {got > 0 ? ' and are waiting for review' : ''}. The other {rest} kept their output.
        {timedOut ? ' Large inputs take longest; try again, or generate those testcases on their own.' : ''}
      </Banner>
    );
  }

  if (job.status === 'stopped') {
    return (
      <Banner tone="info" title="You stopped generation" action={got > 0 ? discard : undefined}>
        {got} {got === 1 ? 'output was' : 'outputs were'} generated
        {got > 0 ? ' and are waiting for review' : ''}. The other {rest} kept their output.
      </Banner>
    );
  }

  const parts = [
    summary.changed.length > 0 && `${summary.changed.length} changed`,
    summary.same.length > 0 && `${summary.same.length} ${summary.same.length === 1 ? 'is' : 'are'} the same as before`,
    summary.created.length > 0 && `${summary.created.length} ${summary.created.length === 1 ? 'is' : 'are'} new`,
  ].filter(Boolean);
  const failures = summary.failed.map((run) => `Testcase ${run.position} ${HAPPENED[failureVerdict(run)]}`);
  const anyChange = summary.changed.length + summary.created.length > 0;
  return (
    <Banner
      tone={got > 0 ? 'brand' : 'warning'}
      title={`Generated ${got} of ${requested} expected outputs with ${solutionLabel}`}
      action={
        <>
          {anyChange && discard}
          {!anyChange && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </>
      }
    >
      {parts.length > 0 ? `${parts.join(', ')}. ` : ''}
      {failures.length > 0 ? `${failures.join('; ')} and kept ${failures.length === 1 ? 'its' : 'their'} output. ` : ''}
      {anyChange ? 'Review them below, then save.' : 'Nothing to save.'}
    </Banner>
  );
}
