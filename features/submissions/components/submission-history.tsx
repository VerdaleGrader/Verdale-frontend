'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { SubmissionTable, type SubmissionRow } from '@/components/grader/submission-table';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { LANGUAGE_LABELS } from '@/features/problems/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { submissionsApi, type SubmissionSummary } from '../api/submissions.api';
import { displayVerdict, outcomeLine } from '../verdicts';

const PAGE_SIZE = 20;

export function toRow(submission: SubmissionSummary, base: string, now?: Date): SubmissionRow {
  return {
    id: submission.id,
    when: timeAgo(submission.created_at, now),
    problem: submission.problem.title,
    href: `${base}/submissions/${submission.id}`,
    author: submission.author.display_name,
    language: LANGUAGE_LABELS[submission.language],
    verdict: displayVerdict(submission),
    detail: submission.status === 'completed' ? outcomeLine({ ...submission, results: [] }) : undefined,
    timeMs: submission.time_ms ?? undefined,
    memoryKb: submission.memory_kb ?? undefined,
  };
}

/** Submissions of one problem: mine, or everyone's for owners and editors. Each row opens the full result and the code. */
export function SubmissionHistory() {
  const params = useParams<{ problemSlug: string }>();
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const target = { slug: space.slug, problemSlug: params.problemSlug };
  const base = `/spaces/${space.slug}/problems/${params.problemSlug}`;
  const list = useApiQuery(
    () => submissionsApi.list(target, { scope, page, pageSize: PAGE_SIZE }),
    `history-${space.slug}-${params.problemSlug}-${scope}-${page}-${auth.status}`
  );

  return (
    <PageContainer>
      <PageHeader
        title="Submissions"
        description={
          scope === 'mine'
            ? 'Your submissions for this problem, newest first.'
            : 'Everyone’s submissions for this problem, newest first.'
        }
        actions={
          <Link href={base} className={buttonVariants({ variant: 'secondary' })}>
            Back to the problem
          </Link>
        }
      />
      {abilities.canAuthorProblems && (
        <Select
          label="Show"
          value={scope}
          options={[
            { value: 'mine', label: 'My submissions' },
            { value: 'all', label: 'Everyone’s submissions' },
          ]}
          onChange={(event) => {
            setScope(event.target.value as 'mine' | 'all');
            setPage(1);
          }}
          className="w-64"
        />
      )}
      {list.status === 'loading' && <Loading label="Loading submissions" />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.status === 'success' &&
        (list.data.items.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="Submit a solution on the problem page and it will show up here."
            action={
              <Link href={base} className={buttonVariants({ variant: 'secondary' })}>
                Go to the problem
              </Link>
            }
          />
        ) : (
          <>
            <SubmissionTable rows={list.data.items.map((item) => toRow(item, base))} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
          </>
        ))}
    </PageContainer>
  );
}
