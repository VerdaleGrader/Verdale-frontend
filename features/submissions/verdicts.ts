import type { TestResultRow } from '@/components/grader/test-result-list';
import { VERDICTS, type Verdict } from '@/components/grader/verdict';
import type { Submission, SubmissionSummary } from './api/submissions.api';

type Stateful = Pick<SubmissionSummary, 'status' | 'verdict'>;

/** The verdict to draw for a submission: the real one, or queued / running while it is in flight. */
export function displayVerdict(submission: Stateful): Verdict {
  if (submission.status === 'completed' && submission.verdict) return submission.verdict;
  return submission.status === 'running' ? 'RUNNING' : 'QUEUED';
}

/** One cell per test for the progress bar: the results when judged, otherwise nothing yet. */
export function progressCells(submission: Pick<Submission, 'status' | 'results' | 'tests_total'>): Verdict[] {
  // Judged: exactly the tests that were reported (none for a compilation or system error).
  if (submission.status === 'completed') return submission.results.map((result) => result.verdict);
  return Array.from({ length: submission.tests_total ?? 0 }, () => 'QUEUED' as const);
}

/** Per-test rows for the results table. Hidden tests carry a verdict, a time and a memory figure and nothing else. */
export function resultRows(results: Submission['results']): TestResultRow[] {
  return results.map((result) => ({
    verdict: result.verdict,
    timeMs: result.verdict === 'SKIPPED' ? undefined : result.time_ms,
    memoryKb: result.verdict === 'SKIPPED' ? undefined : result.memory_kb,
    sample: result.is_sample,
  }));
}

/** "Accepted", "Wrong answer on testcase 4", "Compilation error", "Passed 3 of 10": the one line that says how it went. */
export function outcomeLine(
  submission: Pick<Submission, 'status' | 'verdict' | 'results' | 'tests_passed' | 'tests_total'>
): string {
  if (submission.status !== 'completed' || !submission.verdict) {
    return submission.status === 'running' ? 'Running your solution' : 'Waiting for a judge';
  }
  const label = VERDICTS[submission.verdict].label;
  if (submission.verdict === 'AC' || submission.verdict === 'CE' || submission.verdict === 'ISE') return label;
  const failed = submission.results.find((result) => result.verdict !== 'AC' && result.verdict !== 'SKIPPED');
  if (failed) return `${label} on testcase ${failed.position}`;
  return `${label}`;
}

/** What to say about a failing sample test: where the output first differs, and how it began. */
export function sampleFeedback(results: Submission['results']) {
  return results.filter(
    (result) =>
      result.is_sample &&
      result.verdict !== 'AC' &&
      result.verdict !== 'SKIPPED' &&
      (result.checker_message || result.stdout_preview)
  );
}

/** Compile errors can be long; the page shows the start and lets the person open the rest. */
export const COMPILE_PREVIEW_CHARS = 2000;
