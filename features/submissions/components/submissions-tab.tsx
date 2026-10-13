'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { TestProgress, toCells } from '@/components/grader/test-progress';
import { VERDICTS } from '@/components/grader/verdict';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/states/states';
import { LANGUAGE_LABELS, type Language } from '@/features/problems/types';
import { cn } from '@/lib/utils';
import { formatTime, timeAgo } from '@/lib/format';
import { submissionsApi, type SubmissionSummary } from '../api/submissions.api';
import { displayVerdict, outcomeLine, progressCells } from '../verdicts';
import { Facts } from './result-panel';

/** The code of one submission, fetched when it is first opened (the list carries no source). */
function CodePreview({ submissionId, number }: { submissionId: string; number: number }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'failed' } | { status: 'ready'; source: string }
  >({
    status: 'loading',
  });
  useEffect(() => {
    let cancelled = false;
    submissionsApi.get(submissionId).then(
      (full) => !cancelled && setState({ status: 'ready', source: full.source ?? '' }),
      () => !cancelled && setState({ status: 'failed' })
    );
    return () => {
      cancelled = true;
    };
  }, [submissionId]);
  return (
    <div className="border-border bg-surface-sunken rounded-md border">
      {state.status === 'failed' && (
        <p role="alert" className="text-small text-danger p-3">
          The code of submission #{number} could not be loaded.
        </p>
      )}
      {state.status === 'loading' && <p className="text-small text-text-muted p-3">Loading the code…</p>}
      {state.status === 'ready' && (
        <pre className="vd-codeprev" aria-label={`Code of submission #${number}`}>
          {state.source.split('\n').map((line, index) => (
            <span key={index} className="vd-codeprev__ln">
              {line}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}

/** One thin bar of the tests, small enough for a list row: grouped above 60 tests. */
function MiniBar({ summary }: { summary: SubmissionSummary }) {
  const cells = toCells(progressCells({ ...summary, results: [] }), 60);
  const label = `${summary.tests_passed ?? 0} of ${summary.tests_total ?? 0} testcases passed`;
  return (
    <span className="vd-minibar" role="img" aria-label={label}>
      {(cells.length > 0 ? cells : [{ verdict: 'CE' as const, from: 0, to: 0 }]).map((cell) => (
        <span key={cell.from} className={cn('vd-cell', `vd-cell--${VERDICTS[cell.verdict].cell}`)} />
      ))}
    </span>
  );
}

function passedText(summary: SubmissionSummary) {
  return summary.tests_total === null ? '—' : `${summary.tests_passed ?? 0} / ${summary.tests_total}`;
}

/**
 * The person's own submissions of this problem (GRD-112): the best one pinned on top, then every
 * submission newest first. Each opens to show its tests and its code, and Replace code puts that code in
 * the editor; nothing is submitted until they press Submit.
 */
export function SubmissionsTab({
  best,
  items,
  total,
  loaded,
  error,
  loadingMore,
  onLoadMore,
  onReplace,
  canReplace,
  detailBase,
}: {
  best: SubmissionSummary | null;
  items: SubmissionSummary[];
  total: number;
  loaded: boolean;
  error: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onReplace: (summary: SubmissionSummary) => void;
  /** Whether the problem still accepts a submission's language. */
  canReplace: (language: Language) => boolean;
  /** Where a submission's full result lives; the id is added. */
  detailBase: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [bestOpen, setBestOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-text-muted">
        Only you can see your submissions. Replace code loads one into the editor; nothing is submitted until you press
        Submit.
      </p>
      {error && (
        <p role="alert" className="bg-danger-soft text-danger text-small rounded-md p-3">
          Could not load your submissions: {error}
        </p>
      )}
      {loaded && total === 0 && !error && (
        <EmptyState
          title="No submissions yet"
          description="Your submissions for this problem will appear here, with your best one pinned at the top."
        />
      )}

      {best && (
        <section
          aria-label="Best submission"
          className="bg-surface border-brand-text flex flex-col gap-3 rounded-lg border p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" icon={Check}>
              Best submission
            </Badge>
            <VerdictBadge verdict={displayVerdict(best)} detail={outcomeLine({ ...best, results: [] })} />
            <span className="text-small text-text-muted">
              #{best.number} · {timeAgo(best.created_at)} · {LANGUAGE_LABELS[best.language]}
            </span>
          </div>
          <Facts submission={best} />
          <TestProgress results={progressCells({ ...best, results: [] })} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled={!canReplace(best.language)} onClick={() => onReplace(best)}>
              <RotateCcw aria-hidden />
              Replace code
            </Button>
            <Button variant="ghost" size="sm" aria-expanded={bestOpen} onClick={() => setBestOpen((open) => !open)}>
              {bestOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
              {bestOpen ? 'Hide code' : 'Preview code'}
            </Button>
            <span className="flex-1" />
            <span className="text-text-muted text-[12px]">Most testcases passed; ties go to the earliest.</span>
          </div>
          {bestOpen && <CodePreview submissionId={best.id} number={best.number} />}
        </section>
      )}

      {items.length > 0 && (
        <section aria-label="All submissions" className="border-border bg-surface overflow-hidden rounded-lg border">
          <div className="border-border bg-surface-sunken text-text-muted flex h-9 items-center justify-between border-b px-3 text-[12px] font-medium">
            <span>All submissions · newest first</span>
            <span className="vd-mono">{total} total</span>
          </div>
          <ul className="m-0 list-none p-0">
            {items.map((item) => {
              const open = openId === item.id;
              return (
                <li key={item.id} className="border-border flex flex-col border-b p-1 last:border-b-0">
                  <button
                    type="button"
                    className="vd-subrow"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    <span className="vd-mono text-text-muted w-8 text-[12px]">#{item.number}</span>
                    <span className="vd-subrow__verdict">
                      <VerdictBadge verdict={displayVerdict(item)} format="auto" />
                    </span>
                    <span className="vd-subrow__bar">
                      <MiniBar summary={item} />
                    </span>
                    <span className="vd-mono w-[72px] text-right text-[12px]">{passedText(item)}</span>
                    <span className="vd-mono text-text-muted w-14 text-right text-[12px]">
                      {item.time_ms === null ? '—' : formatTime(item.time_ms)}
                    </span>
                    <span className="text-small text-text-muted w-[88px] text-right">{timeAgo(item.created_at)}</span>
                  </button>
                  {open && (
                    <div className="flex flex-col gap-3 px-3 pt-2 pb-3">
                      <TestProgress results={progressCells({ ...item, results: [] })} />
                      <CodePreview submissionId={item.id} number={item.number} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canReplace(item.language)}
                          onClick={() => onReplace(item)}
                        >
                          <RotateCcw aria-hidden />
                          Replace code
                        </Button>
                        <Link href={`${detailBase}/${item.id}`} className="vd-link text-small">
                          Full result
                        </Link>
                        <span className="text-text-muted text-[12px]">
                          {LANGUAGE_LABELS[item.language]}
                          {!canReplace(item.language) && ' · this problem no longer accepts it'}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {items.length < total && (
            <div className="border-border border-t p-2">
              <Button variant="secondary" size="sm" disabled={loadingMore} onClick={onLoadMore}>
                {loadingMore ? 'Loading…' : 'Show more'}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
