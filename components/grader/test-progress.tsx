import { VERDICTS, type Verdict } from './verdict';
import { cn } from '@/lib/utils';

/** Words for the status line: "Running testcase 3 of 20", "Wrong answer on testcase 7", "Accepted". */
export function progressSummary(results: Verdict[]): string {
  const total = results.length;
  if (total === 0) return 'No testcases yet';
  const failedAt = results.findIndex((verdict) => !['AC', 'QUEUED', 'RUNNING', 'SKIPPED'].includes(verdict));
  if (failedAt >= 0) return `${VERDICTS[results[failedAt]!].label} on testcase ${failedAt + 1}`;
  const runningAt = results.indexOf('RUNNING');
  if (runningAt >= 0) return `Running testcase ${runningAt + 1} of ${total}`;
  if (results.every((verdict) => verdict === 'AC')) return 'Accepted';
  const done = results.filter((verdict) => verdict === 'AC').length;
  return done === 0 ? 'Queued' : `Passed ${done} of ${total}`;
}

/** Above this many tests the bar groups neighbours, so hundreds of tests stay a few short rows. */
export const MAX_CELLS = 120;

const PENDING: Verdict[] = ['QUEUED', 'RUNNING'];

/** The one verdict that stands for a group of tests: a failure first, then still running, queued, passed. */
function groupVerdict(group: Verdict[]): Verdict {
  const failed = group.find((verdict) => !['AC', 'QUEUED', 'RUNNING', 'SKIPPED'].includes(verdict));
  if (failed) return failed;
  if (group.includes('RUNNING')) return 'RUNNING';
  if (group.includes('QUEUED')) return 'QUEUED';
  return group.includes('AC') ? 'AC' : 'SKIPPED';
}

interface Cell {
  verdict: Verdict;
  /** 1-based first and last testcase the cell stands for. */
  from: number;
  to: number;
}

/** One cell per test, or one per group of neighbours when there are more than `maxCells` tests. */
export function toCells(results: Verdict[], maxCells = MAX_CELLS): Cell[] {
  if (results.length <= maxCells) {
    return results.map((verdict, index) => ({ verdict, from: index + 1, to: index + 1 }));
  }
  const size = Math.ceil(results.length / maxCells);
  const cells: Cell[] = [];
  for (let start = 0; start < results.length; start += size) {
    const group = results.slice(start, start + size);
    cells.push({ verdict: groupVerdict(group), from: start + 1, to: start + group.length });
  }
  return cells;
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
  const finished = results.filter((verdict) => !PENDING.includes(verdict)).length;
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
        {toCells(results).map((cell) => (
          <span
            key={cell.from}
            className={cn('vd-cell', `vd-cell--${VERDICTS[cell.verdict].cell}`)}
            title={`${cell.from === cell.to ? `Testcase ${cell.from}` : `Testcases ${cell.from} to ${cell.to}`}: ${VERDICTS[cell.verdict].label}`}
          />
        ))}
      </div>
    </div>
  );
}
