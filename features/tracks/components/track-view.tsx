'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { STATUS_LABELS } from '@/features/problems/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import { VISIBILITY_LABELS, type TrackCollection, type TrackProblem } from '../types';
import { ProgressBar } from './progress-bar';

/** One Track as a solver sees it: Collections and problems in order, with their own progress and verdicts (GRD-84). */
export function TrackView() {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const params = useParams<{ trackSlug: string }>();
  const base = `/spaces/${space.slug}`;
  const track = useApiQuery(
    () => tracksApi.get(space.slug, params.trackSlug),
    `track-${space.slug}-${params.trackSlug}-${auth.status}`
  );

  if (track.status === 'loading' || auth.status === 'loading') return <Loading label="Loading the Track" />;
  if (track.status === 'error') {
    const notFound = track.error instanceof ApiError && track.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Track not found"
        description="It may not exist, may be archived, or may be open only to people who were invited to it."
        action={
          <Link href={base} className={buttonVariants({ variant: 'secondary' })}>
            Back to {space.name}
          </Link>
        }
      />
    ) : (
      <ErrorState error={track.error} onRetry={track.reload} />
    );
  }

  const data = track.data;
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={base} className="vd-link">
          {space.name}
        </Link>
        <span aria-hidden>/</span>
        <span>{data.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-h1 break-words">{data.name}</h2>
          <span className="flex flex-wrap gap-1.5">
            {data.archived_at && <Badge>Archived</Badge>}
            {abilities.canAuthorProblems && data.visibility === 'members' && (
              <Badge tone="info">{VISIBILITY_LABELS.members}</Badge>
            )}
          </span>
          {data.description && <p className="text-prose text-text-muted max-w-[var(--measure)]">{data.description}</p>}
        </div>
        {abilities.canAuthorProblems && (
          <Link href={`${base}/manage/tracks/${data.slug}`} className={buttonVariants({ variant: 'secondary' })}>
            <Settings2 aria-hidden />
            Edit this Track
          </Link>
        )}
      </header>

      {auth.status === 'anonymous' && (
        <p role="status" className="bg-surface-sunken text-small rounded-md p-3">
          You are browsing as a visitor.{' '}
          <Link href={`/login?next=${encodeURIComponent(`${base}/tracks/${data.slug}`)}`} className="vd-link">
            Log in
          </Link>{' '}
          to submit solutions and keep track of your progress.
        </p>
      )}

      {data.progress && data.progress.total > 0 && (
        <section aria-label="Your progress" className="max-w-md">
          <ProgressBar progress={data.progress} label={`Your progress in ${data.name}`} />
        </section>
      )}

      {data.collections.length === 0 ? (
        <EmptyState
          title="Nothing in this Track yet"
          description={
            abilities.canAuthorProblems
              ? 'Add a Collection of problems to this Track from its editor.'
              : 'Problems will appear here once the people who run this Space add them.'
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {data.collections.map((collection) => (
            <CollectionSection
              key={collection.id}
              collection={collection}
              spaceBase={base}
              showStatus={abilities.canAuthorProblems}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionSection({
  collection,
  spaceBase,
  showStatus,
}: {
  collection: TrackCollection;
  spaceBase: string;
  showStatus: boolean;
}) {
  const headingId = `collection-${collection.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={headingId} className="text-h2 break-words">
            {collection.name}
            {collection.archived_at && (
              <>
                {' '}
                <Badge>Archived</Badge>
              </>
            )}
          </h3>
          {collection.description && <p className="text-small text-text-muted">{collection.description}</p>}
        </div>
        {collection.progress && collection.progress.total > 0 && (
          <div className="w-48">
            <ProgressBar progress={collection.progress} label={`Progress in ${collection.name}`} />
          </div>
        )}
      </div>
      {collection.problems.length === 0 ? (
        <p className="text-small text-text-muted">No problems here yet.</p>
      ) : (
        <ol className="border-border bg-surface rounded-md border" aria-label={`Problems in ${collection.name}`}>
          {collection.problems.map((problem, index) => (
            <ProblemRow
              key={problem.id}
              problem={problem}
              number={index + 1}
              spaceBase={spaceBase}
              showStatus={showStatus}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ProblemRow({
  problem,
  number,
  spaceBase,
  showStatus,
}: {
  problem: TrackProblem;
  /** 1-based place among the problems this person sees: drafts they cannot see leave no gap. */
  number: number;
  spaceBase: string;
  showStatus: boolean;
}) {
  const href =
    showStatus && problem.status === 'draft'
      ? `${spaceBase}/problems/${problem.slug}/edit`
      : `${spaceBase}/problems/${problem.slug}`;
  return (
    <li className="vd-problemrow">
      <span className="text-mono-label text-text-muted w-6 shrink-0 text-right" aria-hidden>
        {number}
      </span>
      <span className="min-w-0 flex-1">
        <Link href={href} className="vd-link">
          {problem.title}
        </Link>
        <span className="text-mono-label text-text-muted vd-cell-sub">{problem.slug}</span>
      </span>
      {showStatus && problem.status !== 'published' && (
        <Badge tone={problem.status === 'draft' ? 'warning' : 'neutral'}>{STATUS_LABELS[problem.status]}</Badge>
      )}
      {problem.my_verdict && <VerdictBadge verdict={problem.my_verdict} compact />}
    </li>
  );
}
