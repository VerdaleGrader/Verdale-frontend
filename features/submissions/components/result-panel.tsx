'use client';

import Link from 'next/link';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VerdictInfo } from '@/components/grader/verdict-info';
import { TestProgress } from '@/components/grader/test-progress';
import { formatMemory, formatTime, timeAgo } from '@/lib/format';
import type { Submission } from '../api/submissions.api';
import type { Connection } from '../hooks/use-submission-live';
import { displayVerdict, outcomeLine, progressCells } from '../verdicts';
import { TestcaseExplorer } from './testcase-explorer';

/** Time, memory and how many tests passed: the three numbers under a verdict. */
export function Facts({
  submission,
}: {
  submission: Pick<Submission, 'time_ms' | 'memory_kb' | 'tests_passed' | 'tests_total'>;
}) {
  const fact = (name: string, value: string) => (
    <div className="flex items-baseline gap-2">
      <dt className="text-small text-text-muted">{name}</dt>
      <dd className="vd-mono m-0 text-[13px]">{value}</dd>
    </div>
  );
  return (
    <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2">
      {fact('Time', submission.time_ms === null ? '—' : formatTime(submission.time_ms))}
      {fact('Memory', submission.memory_kb === null ? '—' : formatMemory(submission.memory_kb))}
      {fact(
        'Passed',
        submission.tests_total === null ? '—' : `${submission.tests_passed ?? 0} / ${submission.tests_total}`
      )}
    </dl>
  );
}

/**
 * The result of the latest submission, under the editor and kept there after judging (GRD-112): the
 * verdict, the numbers, the progress of the tests and every testcase to look at one by one.
 */
export function ResultPanel({
  submission,
  connection,
  detailHref,
  samples,
  closed = false,
}: {
  submission: Submission | undefined;
  /** The problem takes no new submissions. */
  closed?: boolean;
  connection?: Connection;
  detailHref: string;
  samples: Array<{ output: string }>;
}) {
  if (!submission) {
    return (
      <section aria-label="Result" className="border-border bg-surface flex flex-col gap-1 rounded-lg border p-4">
        <p className="text-body-strong">No result yet</p>
        <p className="text-small text-text-muted">
          {closed
            ? 'Submissions are closed.'
            : 'Submit to judge your code against every testcase. The result and every testcase stay here after judging finishes.'}
        </p>
      </section>
    );
  }
  const finished = submission.status === 'completed';
  const verdict = displayVerdict(submission);
  const verdicts = progressCells(submission);
  const compileError = finished && submission.verdict === 'CE';
  return (
    <section aria-label="Result" className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={verdict} detail={finished ? outcomeLine(submission) : undefined} />
        <VerdictInfo current={verdict} />
        <span className="text-small text-text-muted">
          Submission #{submission.number} · {timeAgo(submission.created_at)}
        </span>
        <span className="flex-1" />
        <Link href={detailHref} className="vd-link">
          Full result
        </Link>
      </div>
      {!finished && (
        <p className="text-small text-text-muted" aria-live="polite">
          {outcomeLine(submission)}
          {connection === 'polling' && ' (checking every few seconds)'}
          {connection === 'reconnecting' && ' (reconnecting…)'}
        </p>
      )}
      {finished && !compileError && submission.verdict !== 'ISE' && <Facts submission={submission} />}
      {compileError && (
        <div className="flex flex-col gap-2">
          <p className="text-small text-text-muted">
            Your code did not compile, so no testcases ran. Fix the error below and submit again.
          </p>
          {submission.compile_message && (
            <div className="border-border bg-surface-sunken overflow-hidden rounded-md border">
              <div className="border-border bg-surface text-text-muted flex h-8 items-center border-b px-3 text-[12px] font-medium">
                Compiler output
              </div>
              <pre className="vd-mono m-0 overflow-x-auto p-3 text-[13px] leading-5">{submission.compile_message}</pre>
            </div>
          )}
        </div>
      )}
      {finished && submission.verdict === 'ISE' && (
        <p className="text-small text-text-muted">
          This is not caused by your code. Open the full result to check it again.
        </p>
      )}
      {verdicts.length > 0 && <TestProgress results={verdicts} />}
      {finished && verdicts.length > 0 && (
        <TestcaseExplorer key={submission.id} verdicts={verdicts} results={submission.results} samples={samples} />
      )}
    </section>
  );
}
