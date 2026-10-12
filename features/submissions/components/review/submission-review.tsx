'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TestProgress } from '@/components/grader/test-progress';
import { TestcaseList } from '@/components/grader/testcase-list';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VerdictInfo } from '@/components/grader/verdict-info';
import type { Verdict } from '@/components/grader/verdict';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatSummary } from '@/components/ui/stat-summary';
import { ErrorState, Skeleton } from '@/components/states/states';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { LANGUAGE_LABELS } from '@/features/problems/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { formatDateTime, formatMemory, formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useUrlQuery } from '@/lib/use-url-query';
import { cn } from '@/lib/utils';
import { reviewApi } from '../../api/review.api';
import { submissionsApi, type Submission } from '../../api/submissions.api';
import { parseCompilerMessages, sourceFileName } from '../../diagnostics';
import { useSubmissionLive } from '../../hooks/use-submission-live';
import { displayVerdict, outcomeLine } from '../../verdicts';
import { CodePanel } from './code-panel';
import { CompilerPanel } from './compiler-panel';
import { useProblemFacts } from './problem-facts';
import { ReviewGate, Unavailable, isMissing, reviewPath, shortId } from './review-parts';
import { TestcasePanel } from './testcase-panel';

const TABS = ['auto', 'testcases', 'code', 'compiler'] as const;
const QUERY = { tab: param.oneOf(TABS, 'auto'), test: param.text(), compare: param.text() };

/** Cells for the progress bar: what has been judged, then what is still to come. */
function cells(submission: Submission): Verdict[] {
  const judged = submission.results.map((result) => result.verdict);
  if (submission.status === 'completed') return judged;
  const total = Math.max(submission.tests_total ?? 0, judged.length);
  const rest = Array.from({ length: total - judged.length }, (): Verdict => 'QUEUED');
  if (submission.status === 'running' && rest.length > 0) rest[0] = 'RUNNING';
  return [...judged, ...rest];
}

/** The submission page for staff: summary, testcases, code and compiler output. View only: nothing here changes a submission. */
export function SubmissionReview() {
  return (
    <ReviewGate>
      <SubmissionLoader />
    </ReviewGate>
  );
}

function SubmissionLoader() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { space } = useSpace();
  const { auth } = useAuth();
  const first = useApiQuery(() => submissionsApi.get(submissionId), `review-${submissionId}-${auth.status}`);
  const back = reviewPath(space.slug);

  return (
    <>
      {first.status === 'loading' && (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-md border p-4" aria-busy="true">
          <Skeleton width={240} height={28} />
          <Skeleton width="60%" />
        </div>
      )}
      {first.status === 'error' &&
        (isMissing(first.error) ? (
          <Unavailable
            title="This submission isn’t available"
            description="It may not exist, or your role in this Space doesn’t let you see it."
            href={back}
            action="Back to submissions"
          />
        ) : (
          <ErrorState error={first.error} title="The submission could not be loaded" onRetry={first.reload} centered />
        ))}
      {first.status === 'success' &&
        (first.data.space.slug !== space.slug ? (
          <Unavailable
            title="This submission isn’t available"
            description="It may not exist, or your role in this Space doesn’t let you see it."
            href={back}
            action="Back to submissions"
          />
        ) : (
          <Review initial={first.data} />
        ))}
    </>
  );
}

function Review({ initial }: { initial: Submission }) {
  const { space } = useSpace();
  const { auth } = useAuth();
  const pathname = usePathname();
  const { values, set } = useUrlQuery(QUERY);
  const live = useSubmissionLive(initial.id, initial);
  const submission = live.submission ?? initial;
  const author = submission.author;
  const problemSlug = submission.problem.slug;
  const facts = useProblemFacts(space.slug, problemSlug);

  // The same person's other submissions of the problem: Older and Newer, and the Track and version of this one.
  const siblings = useApiQuery(
    () =>
      reviewApi.list(space, { member: author.username, problem: problemSlug, sort: 'newest', page: 1, pageSize: 50 }),
    `siblings-${space.slug}-${author.username}-${problemSlug}-${auth.status}-${submission.status}`
  );
  const rows = siblings.status === 'success' ? siblings.data.items : [];
  const index = rows.findIndex((row) => row.id === submission.id);
  const me = index >= 0 ? rows[index] : undefined;
  const newer = index > 0 ? rows[index - 1] : undefined;
  const older = index >= 0 ? rows[index + 1] : undefined;

  const verdict = displayVerdict(submission);
  const finished = submission.status === 'completed';
  const compile = submission.compile_message ?? '';
  const warnings = parseCompilerMessages(compile).length;
  const tab = values.tab === 'auto' ? (submission.verdict === 'CE' ? 'compiler' : 'testcases') : values.tab;
  const id = shortId(submission.id);
  const progress = cells(submission);
  const firstName = author.display_name.split(' ')[0] ?? author.display_name;
  const base = reviewPath(space.slug);
  const tabHref = (name: (typeof TABS)[number]) => {
    const plain = name === (submission.verdict === 'CE' ? 'compiler' : 'testcases');
    return plain ? pathname : `${pathname}?tab=${name}`;
  };
  const neighbour = (row: typeof older, label: string, Icon: typeof ChevronLeft, before: boolean) =>
    row ? (
      <Link
        href={reviewPath(space.slug, row.id)}
        className={buttonVariants({ size: 'sm' })}
        aria-label={`${label} submission`}
      >
        {before && <Icon aria-hidden />}
        {before ? label : <>{label}</>}
        {!before && <Icon aria-hidden />}
      </Link>
    ) : (
      <Button size="sm" disabled aria-label={`${label} submission`}>
        {before && <Icon aria-hidden />}
        {label}
        {!before && <Icon aria-hidden />}
      </Button>
    );

  const version = me?.version;
  const current = facts.problem?.version_number;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Breadcrumb
          items={[
            { label: 'Submissions', href: base },
            { label: 'By member', href: base },
            { label: author.display_name, href: reviewPath(space.slug, 'members', author.username) },
            {
              label: submission.problem.title,
              href: reviewPath(space.slug, 'members', author.username, problemSlug),
            },
            { label: <span className="vd-mono">{id}</span> },
          ]}
        />
        <div className="flex items-center gap-2">
          <span className="text-small text-text-muted">{firstName}’s submissions on this problem</span>
          {neighbour(older, 'Older', ChevronLeft, true)}
          {neighbour(newer, 'Newer', ChevronRight, false)}
        </div>
      </div>

      <section
        aria-label="Submission summary"
        className="border-border bg-surface flex flex-col gap-4 rounded-md border p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-h2">
                Submission <span className="vd-mono text-lg">{id}</span>
              </h2>
              <VerdictBadge verdict={verdict} detail={outcomeLine(submission)} />
              <VerdictInfo current={verdict} />
            </div>
            <div className="text-small text-text-muted flex flex-wrap items-center gap-2">
              <span className="text-text inline-flex items-center gap-1.5">
                <Avatar name={author.display_name} src={author.avatar_url} size="sm" />
                {author.display_name}
              </span>
              <span aria-hidden>·</span>
              <Link href={`/spaces/${space.slug}/problems/${problemSlug}`} className="vd-link">
                {submission.problem.title}
              </Link>
              <span aria-hidden>·</span>
              <span>{LANGUAGE_LABELS[submission.language]}</span>
              {me && (
                <>
                  <span aria-hidden>·</span>
                  <span>Track: {me.track ? me.track.name : 'none'}</span>
                  <span aria-hidden>·</span>
                  <span>
                    Problem version {me.version}
                    {current === me.version ? ' (current)' : ''}
                  </span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>Submitted {formatDateTime(submission.created_at)}</span>
            </div>
          </div>
          <StatSummary
            className="[&_dd]:text-lg"
            stats={[
              {
                label: 'Testcases passed',
                value:
                  submission.tests_total === null ? '—' : `${submission.tests_passed ?? 0} / ${submission.tests_total}`,
              },
              {
                label: 'Max time',
                value:
                  finished && submission.time_ms !== null && submission.verdict !== 'CE'
                    ? formatTime(submission.time_ms)
                    : '—',
              },
              {
                label: 'Max memory',
                value:
                  finished && submission.memory_kb !== null && submission.verdict !== 'CE'
                    ? formatMemory(submission.memory_kb)
                    : '—',
              },
            ]}
          />
        </div>
        {submission.verdict !== 'CE' && progress.length > 0 && <TestProgress results={progress} />}
        {!finished && (
          <p className="text-text-muted" aria-live="polite">
            {submission.status === 'queued'
              ? 'The code can be read in the Code tab while it waits.'
              : 'Finished testcases can be opened now. The rest appear as the judge reaches them.'}
            {live.connection === 'polling' && ' (checking every few seconds)'}
            {live.connection === 'reconnecting' && ' (reconnecting…)'}
          </p>
        )}
      </section>

      {version !== undefined && current !== undefined && version !== current && (
        <Banner tone="info">
          This submission was judged on version {version}. The testcases, expected output and limits below are from
          version {version}, not the current version {current}.
        </Banner>
      )}

      <nav aria-label="Submission sections" className="vd-tabs">
        <Link
          href={tabHref('testcases')}
          aria-current={tab === 'testcases' ? 'page' : undefined}
          className={cn('vd-tab', tab === 'testcases' && 'is-active')}
        >
          Testcases <span className="vd-tab__count">{submission.results.length}</span>
        </Link>
        <Link
          href={tabHref('code')}
          aria-current={tab === 'code' ? 'page' : undefined}
          className={cn('vd-tab', tab === 'code' && 'is-active')}
        >
          Code
        </Link>
        <Link
          href={tabHref('compiler')}
          aria-current={tab === 'compiler' ? 'page' : undefined}
          className={cn('vd-tab', tab === 'compiler' && 'is-active')}
        >
          Compiler output {compile !== '' && <span className="vd-tab__count">{warnings}</span>}
        </Link>
      </nav>

      {tab === 'testcases' && (
        <TestcasesTab submission={submission} test={values.test} onSelect={(test) => set({ test })} />
      )}
      {tab === 'code' && (
        <CodePanel
          submission={submission}
          siblings={rows}
          compareId={values.compare}
          onCompare={(compare) => set({ compare })}
        />
      )}
      {tab === 'compiler' && (
        <CompilerPanel
          output={submission.compile_message}
          source={submission.source ?? ''}
          fileName={sourceFileName(submission.language)}
          codeHref={tabHref('code')}
        />
      )}
    </>
  );
}

function TestcasesTab({
  submission,
  test,
  onSelect,
}: {
  submission: Submission;
  test: string;
  onSelect: (test: string) => void;
}) {
  const results = submission.results;
  if (results.length === 0) {
    return (
      <p className="text-text-muted">
        {submission.verdict === 'CE'
          ? 'No testcases were run: the code did not compile. The compiler output has the details.'
          : submission.verdict === 'ISE'
            ? 'No testcase result was recorded: the judge failed before it finished.'
            : submission.status === 'completed'
              ? 'No testcase results were recorded.'
              : 'No testcase has finished yet.'}
      </p>
    );
  }
  const failing = results.find((result) => result.verdict !== 'AC' && result.verdict !== 'SKIPPED');
  const selected = results.find((result) => String(result.position) === test) ?? failing ?? results[0]!;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <TestcaseList
        items={results.map((result) => ({
          id: result.position,
          position: result.position,
          sample: result.is_sample,
          verdict: result.verdict,
          timeMs: result.verdict === 'SKIPPED' ? undefined : result.time_ms,
        }))}
        selectedId={selected.position}
        onSelect={(id) => onSelect(String(id))}
      />
      <TestcasePanel submission={submission} result={selected} authorName={submission.author.display_name} />
    </div>
  );
}
