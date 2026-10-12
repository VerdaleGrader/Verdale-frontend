import { VERDICTS, type Verdict } from './verdict';
import { cn } from '@/lib/utils';

/** Words for the status line: "Running test 3 of 20", "Wrong answer on test 7", "Accepted". */
export function progressSummary(results: Verdict[]): string {
  const total = results.length;
  if (total === 0) return 'No tests yet';
  const failedAt = results.findIndex((verdict) => !['AC', 'QUEUED', 'RUNNING', 'SKIPPED'].includes(verdict));
  if (failedAt >= 0) return `${VERDICTS[results[failedAt]!].label} on test ${failedAt + 1}`;
  const runningAt = results.indexOf('RUNNING');
  if (runningAt >= 0) return `Running test ${runningAt + 1} of ${total}`;
  if (results.every((verdict) => verdict === 'AC')) return 'Accepted';
  const done = results.filter((verdict) => verdict === 'AC').length;
  return done === 0 ? 'Queued' : `Passed ${done} of ${total}`;
}

/** Live judging progress: one cell per test, filled with its verdict colour when it finishes. */
export function TestProgress({
  results,
  label,
  ariaLabel = 'Judging progress',
}: {
  results: Verdict[];
  /**
   * The status text, when the default judging words do not fit: "Generating output 3 of 12",
   * "All 12 outputs generated". Cells and the count are unchanged.
   */
  label?: string;
  /** Names the progress bar for screen readers: "Generation progress". */
  ariaLabel?: string;
}) {
  const total = results.length;
  const finished = results.filter((verdict) => !['QUEUED', 'RUNNING'].includes(verdict)).length;
  const summary = label ?? progressSummary(results);
  return (
    <div className="vd-progress">
      <div className="vd-progress__head">
        <span className="vd-progress__status" aria-live="polite">
          {summary}
        </span>
        <span className="vd-progress__count">
          {finished} / {total}
        </span>
      </div>
      <div
        className="vd-progress__cells"
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={finished}
        aria-valuetext={summary}
      >
        {results.map((verdict, index) => (
          <span
            key={index}
            className={cn('vd-cell', `vd-cell--${VERDICTS[verdict].cell}`)}
            title={`Test ${index + 1}: ${VERDICTS[verdict].label}`}
          />
        ))}
      </div>
    </div>
  );
}
