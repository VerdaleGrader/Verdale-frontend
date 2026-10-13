'use client';

import { useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { DiffView } from '@/components/grader/diff-view';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VERDICTS, type Verdict } from '@/components/grader/verdict';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatMemory, formatTime } from '@/lib/format';
import type { Submission } from '../api/submissions.api';

/** The short code drawn in a cell: the verdict's own, or a mark for a test that has not finished. */
function cellCode(verdict: Verdict): string {
  if (verdict === 'QUEUED') return '·';
  if (verdict === 'RUNNING') return '…';
  if (verdict === 'SKIPPED') return '–';
  return verdict;
}

const HIDDEN_NOTE =
  'Hidden testcase. Its input and expected output are private to the problem’s editors; only the verdict, time and memory are shown.';

/**
 * Every testcase of one submission as a grid, with a filter for the ones that did not pass and the
 * detail of the chosen one: the output beside the expected output for an example, the verdict, time and
 * memory for a hidden one. The grid scrolls inside its own box, so hundreds of testcases never push the page.
 */
export function TestcaseExplorer({
  verdicts,
  results,
  samples,
}: {
  /** One verdict per test, in judging order. */
  verdicts: Verdict[];
  /** Per-test results of the submission; missing until the full result arrives. */
  results: Submission['results'];
  /** The problem's examples, in order, for the expected output. */
  samples: Array<{ output: string }>;
}) {
  const failedCount = verdicts.filter((verdict) => verdict !== 'AC').length;
  const [filter, setFilter] = useState<'all' | 'failed'>(verdicts.length > 60 && failedCount > 0 ? 'failed' : 'all');
  const firstFailed = verdicts.findIndex((verdict) => !['AC', 'QUEUED', 'RUNNING'].includes(verdict));
  const [picked, setPicked] = useState<number | null>(null);
  const selected =
    picked !== null && picked < verdicts.length
      ? picked
      : firstFailed >= 0
        ? firstFailed
        : verdicts.includes('RUNNING')
          ? null
          : 0;

  const shown = verdicts
    .map((verdict, index) => ({ verdict, index }))
    .filter(({ verdict }) => filter === 'all' || verdict !== 'AC');

  return (
    <div className="border-border flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-strong text-[16px] leading-6">Testcases</h3>
        <div role="group" aria-label="Show testcases" className="vd-seg">
          <button
            type="button"
            className={cn('vd-seg__btn', filter === 'all' && 'is-on')}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All {verdicts.length}
          </button>
          <button
            type="button"
            className={cn('vd-seg__btn', filter === 'failed' && 'is-on')}
            aria-pressed={filter === 'failed'}
            onClick={() => setFilter('failed')}
          >
            Not passed {failedCount}
          </button>
        </div>
      </div>

      <div className="vd-tcgrid__scroll">
        <div className="vd-tcgrid">
          {shown.map(({ verdict, index }) => {
            const label = `Testcase ${index + 1}: ${VERDICTS[verdict].label}${results[index]?.is_sample ? ' (sample)' : ''}`;
            return (
              <button
                key={index}
                type="button"
                className={cn('vd-tc', `vd-tc--${VERDICTS[verdict].cell}`, index === selected && 'is-sel')}
                aria-pressed={index === selected}
                aria-label={label}
                title={label}
                onClick={() => setPicked(index)}
              >
                <span className="vd-tc__n">{index + 1}</span>
                <span className="vd-tc__c">{cellCode(verdict)}</span>
              </button>
            );
          })}
        </div>
        {shown.length === 0 && <p className="text-small text-text-muted py-2">Every testcase passed.</p>}
      </div>

      {selected !== null && verdicts[selected] && (
        <TestcaseDetail position={selected} verdict={verdicts[selected]} results={results} samples={samples} />
      )}
    </div>
  );
}

function TestcaseDetail({
  position,
  verdict,
  results,
  samples,
}: {
  position: number;
  verdict: Verdict;
  results: Submission['results'];
  samples: Array<{ output: string }>;
}) {
  const result = results[position];
  // Nothing to show until the full result (which carries the times and the example outputs) arrives.
  if (!result && verdict !== 'QUEUED' && verdict !== 'RUNNING') return null;
  const ran = result !== undefined && verdict !== 'QUEUED' && verdict !== 'RUNNING' && verdict !== 'SKIPPED';
  const isSample = result?.is_sample === true && ran;
  const sampleIndex = results.slice(0, position).filter((earlier) => earlier.is_sample).length;
  const expected = samples[sampleIndex]?.output;
  return (
    <div className="border-border bg-bg flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body-strong">Testcase {position + 1}</span>
        {result && <Badge icon={result.is_sample ? FileText : Eye}>{result.is_sample ? 'Sample' : 'Hidden'}</Badge>}
        <VerdictBadge verdict={verdict} />
        <span className="flex-1" />
        {ran && (
          <span className="vd-mono text-text-muted text-[12px]">
            {formatTime(result.time_ms)} · {formatMemory(result.memory_kb)}
          </span>
        )}
      </div>
      {isSample && expected !== undefined && (
        <DiffView expected={expected} actual={result.stdout_preview ?? ''} actualLabel="Your output" />
      )}
      {isSample && expected === undefined && result.checker_message && (
        <p className="text-small text-text-muted">{result.checker_message}</p>
      )}
      {!isSample && (
        <p className="text-small text-text-muted">{ran ? HIDDEN_NOTE : 'This testcase has not run yet.'}</p>
      )}
    </div>
  );
}
