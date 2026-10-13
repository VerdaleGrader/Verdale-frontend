'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { TestProgress } from '@/components/grader/test-progress';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { Button } from '@/components/ui/button';
import { Dropdown, type DropdownOption } from '@/components/ui/dropdown';
import { VERDICTS } from '@/components/grader/verdict';
import { LANGUAGE_LABELS } from '@/features/problems/types';
import { errorMessage } from '@/lib/api';
import { formatMemory, formatTime, timeAgo } from '@/lib/format';
import { submissionsApi, type Submission, type SubmissionSummary } from '../api/submissions.api';
import { displayVerdict, outcomeLine, progressCells } from '../verdicts';

const PAGE_SIZE = 10;
/** The last entry of the dropdown, which loads the next page instead of choosing a submission. */
const MORE = '__more__';

type Target = { slug: string; problemSlug: string };

/**
 * The person's own earlier submissions of this problem (GRD-112): the best one on top and set apart,
 * then the rest, newest first. Each shows its tests as a progress bar and can put its code back in the editor.
 * `refreshKey` changes whenever the latest submission does, so the list follows new results.
 */
export function PreviousSubmissions({
  target,
  refreshKey,
  detailBase,
  onUse,
}: {
  target: Target;
  refreshKey: string;
  /** Where a submission's full result lives; the id is added. */
  detailBase: string;
  /** Receives the full submission (with its source) the person chose. */
  onUse: (submission: Submission) => void;
}) {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [best, setBest] = useState<SubmissionSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Start again from the first page whenever the latest submission changes.
  useEffect(() => {
    let cancelled = false;
    submissionsApi.list(target, { scope: 'mine', page: 1, pageSize: PAGE_SIZE }).then(
      (page) => {
        if (cancelled) return;
        setItems(page.items);
        setBest(page.best ?? null);
        setSelectedId((current) => current ?? page.best?.id ?? null);
        setTotal(page.total);
        setFailed(null);
        setLoaded(true);
      },
      (error: unknown) => {
        if (!cancelled) {
          setFailed(errorMessage(error));
          setLoaded(true);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [target, refreshKey]);

  const showMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = Math.floor(items.length / PAGE_SIZE) + 1;
      const page = await submissionsApi.list(target, { scope: 'mine', page: next, pageSize: PAGE_SIZE });
      setItems((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setTotal(page.total);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, target]);

  const choose = useCallback(
    async (summary: SubmissionSummary) => {
      setChoosing(summary.id);
      setProblem(null);
      try {
        onUse(await submissionsApi.get(summary.id));
      } catch (error) {
        setProblem(errorMessage(error));
      } finally {
        setChoosing(null);
      }
    },
    [onUse]
  );

  if (!loaded) return null;
  if (failed) {
    return (
      <p role="alert" className="text-small text-danger">
        Could not load your earlier submissions: {failed}
      </p>
    );
  }
  if (total === 0) {
    return <p className="text-small text-text-muted">Your earlier submissions of this problem will be listed here.</p>;
  }

  // The best comes first and is named as such; the rest follow newest first.
  const ordered = best ? [best, ...items.filter((item) => item.id !== best.id)] : items;
  const optionFor = (summary: SubmissionSummary): DropdownOption => {
    const verdict = displayVerdict(summary);
    const cells = progressCells({ ...summary, results: [] });
    const outcome = summary.status === 'completed' ? outcomeLine({ ...summary, results: [] }) : VERDICTS[verdict].label;
    const passed =
      summary.status === 'completed' && summary.tests_total !== null
        ? ` · ${summary.tests_passed ?? 0}/${summary.tests_total}`
        : '';
    return {
      value: summary.id,
      label: `${summary.id === best?.id ? 'Best submission · ' : ''}${outcome}${passed}`,
      description: `${LANGUAGE_LABELS[summary.language]} · ${timeAgo(summary.created_at)}`,
      // Each submission carries its own TestProgress, in the list as well as in the detail below.
      extra:
        cells.length > 0 ? <TestProgress results={cells} compact ariaLabel="Result of each testcase" /> : undefined,
    };
  };
  const options: DropdownOption[] = ordered.map(optionFor);
  if (items.length < total) options.push({ value: MORE, label: loadingMore ? 'Loading…' : 'Show more…' });
  const chosen = ordered.find((item) => item.id === selectedId) ?? null;

  return (
    <section aria-label="Your earlier submissions" className="flex flex-col gap-3">
      {problem && (
        <p role="alert" className="bg-danger-soft text-danger text-small rounded-md p-3">
          {problem}
        </p>
      )}
      <Dropdown
        label="Previous submissions"
        placeholder="Choose a submission"
        options={options}
        value={chosen?.id}
        onValueChange={(next) => {
          if (next === MORE) void showMore();
          else setSelectedId(next);
        }}
      />
      {chosen && (
        <ul>
          <SubmissionRow
            summary={chosen}
            href={`${detailBase}/${chosen.id}`}
            choosing={choosing === chosen.id}
            onChoose={() => void choose(chosen)}
          />
        </ul>
      )}
    </section>
  );
}

function SubmissionRow({
  summary,
  href,
  choosing,
  onChoose,
}: {
  summary: SubmissionSummary;
  href: string;
  choosing: boolean;
  onChoose: () => void;
}) {
  const finished = summary.status === 'completed';
  const cells = progressCells({ ...summary, results: [] });
  return (
    <li className="border-border bg-surface flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <VerdictBadge
            verdict={displayVerdict(summary)}
            detail={finished ? outcomeLine({ ...summary, results: [] }) : undefined}
          />
          <span className="text-small text-text-muted">
            {LANGUAGE_LABELS[summary.language]} · {timeAgo(summary.created_at)}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <Link href={href} className="vd-link text-small">
            Open
          </Link>
          <Button variant="secondary" size="sm" onClick={onChoose} disabled={choosing}>
            {choosing ? 'Loading…' : 'Use this code'}
          </Button>
        </span>
      </div>
      {finished && summary.time_ms !== null && summary.memory_kb !== null && (
        <p className="text-small text-text-muted vd-mono">
          {formatTime(summary.time_ms)} · {formatMemory(summary.memory_kb)}
          {summary.tests_total !== null && ` · passed ${summary.tests_passed ?? 0} of ${summary.tests_total}`}
        </p>
      )}
      {cells.length > 0 && <TestProgress results={cells} compact ariaLabel="Result of each testcase" />}
    </li>
  );
}
