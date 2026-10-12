'use client';

import Link from 'next/link';
import { TestProgress } from '@/components/grader/test-progress';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VERDICTS } from '@/components/grader/verdict';
import { formatMemory, formatTime } from '@/lib/format';
import type { Submission } from '../api/submissions.api';
import type { Connection } from '../hooks/use-submission-live';
import { displayVerdict, outcomeLine, progressCells } from '../verdicts';

/**
 * How a submission is going, in a few lines: the verdict (or queued / running),
 * the one-line outcome, time and memory, and the test cells once judged.
 * Used under the editor and at the top of the full result.
 */
export function LiveStatus({
  submission,
  connection,
  detailHref,
}: {
  submission: Submission;
  connection?: Connection;
  /** Link to the full result, shown while there is more to read. */
  detailHref?: string;
}) {
  const verdict = displayVerdict(submission);
  const finished = submission.status === 'completed';
  const cells = progressCells(submission);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={verdict} detail={finished ? outcomeLine(submission) : undefined} />
          {!finished && (
            <span className="text-small text-text-muted" aria-live="polite">
              {outcomeLine(submission)}
              {connection === 'polling' && ' (checking every few seconds)'}
              {connection === 'reconnecting' && ' (reconnecting…)'}
            </span>
          )}
        </span>
        {detailHref && (
          <Link href={detailHref} className="vd-link text-small">
            {finished ? 'Full result' : 'Open'}
          </Link>
        )}
      </div>
      {finished && submission.verdict !== 'CE' && submission.verdict !== 'ISE' && (
        <dl className="vd-problem__meta" style={{ margin: 0, padding: 0, border: 0 }}>
          {submission.time_ms !== null && (
            <div>
              <dt>Time</dt>
              <dd>{formatTime(submission.time_ms)}</dd>
            </div>
          )}
          {submission.memory_kb !== null && (
            <div>
              <dt>Memory</dt>
              <dd>{formatMemory(submission.memory_kb)}</dd>
            </div>
          )}
          {submission.tests_total !== null && (
            <div>
              <dt>Passed</dt>
              <dd>
                {submission.tests_passed ?? 0} of {submission.tests_total}
              </dd>
            </div>
          )}
        </dl>
      )}
      {finished && cells.length > 0 && <TestProgress results={cells} />}
      {finished && submission.verdict === 'ISE' && detailHref && (
        <p className="text-small text-text-muted">
          {VERDICTS.ISE.label}: this is not caused by your code. Open the result to check it again.
        </p>
      )}
    </div>
  );
}
