'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VERDICTS, type Verdict } from '@/components/grader/verdict';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ClickableRow } from '@/components/ui/clickable-row';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { catalogApi } from '../api/catalog.api';
import { PRIVACY_LABELS, PROBLEM_STATUS_LABELS, type CollectionInTrack, type ProblemRef } from '../types';
import { ProgressMeter } from './progress-meter';

/** A verdict string from Core, or undefined when it is not one the badge knows. */
function verdictOf(raw: string | null): Verdict | undefined {
  return raw !== null && raw in VERDICTS ? (raw as Verdict) : undefined;
}

/** One Track: its Collections in order, each problem with the person's result, and progress bars. */
export function TrackView() {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const params = useParams<{ trackSlug: string }>();
  const track = useApiQuery(
    () => catalogApi.track(space.slug, params.trackSlug),
    `track-${space.slug}-${params.trackSlug}-${auth.status}`
  );

  if (track.status === 'loading' || auth.status === 'loading') return <Loading label="Loading the Track" />;
  if (track.status === 'error') {
    const notFound = track.error instanceof ApiError && track.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Track not found"
        description={
          auth.status === 'anonymous'
            ? 'It may not exist, or it is only open to people who were added to it. If you were invited, log in first.'
            : 'It may not exist, or it is only open to people who were added to it. Ask the Space’s owner for an invitation.'
        }
        action={
          <Link href={`/spaces/${space.slug}/tracks`} className={buttonVariants({ variant: 'secondary' })}>
            All Tracks
          </Link>
        }
      />
    ) : (
      <ErrorState error={track.error} onRetry={track.reload} />
    );
  }
  const data = track.data;
  const base = `/spaces/${space.slug}/tracks/${data.slug}`;
  const staff = abilities.canAuthorProblems;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}/tracks`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <span>{data.name}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-h2 break-words">{data.name}</h2>
            <span className="flex flex-wrap gap-1.5">
              {staff && <Badge tone="info">{PRIVACY_LABELS[data.privacy]}</Badge>}
              {data.archived && <Badge tone="warning">Archived</Badge>}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {abilities.canReviewSubmissions && (
              <Link href={`${base}/progress`} className={buttonVariants({ variant: 'secondary' })}>
                <Users aria-hidden />
                Progression
              </Link>
            )}
            {staff && (
              <Link href={`${base}/members`} className={buttonVariants({ variant: 'secondary' })}>
                Access
              </Link>
            )}
            {abilities.canEditProblems && (
              <Link href={`${base}/edit`} className={buttonVariants({ variant: 'secondary' })}>
                Edit Track
              </Link>
            )}
          </div>
        </div>
        {data.description && <p className="text-prose text-text-muted max-w-[var(--measure)]">{data.description}</p>}
        <ProgressMeter progress={data.progress} label={`Progress in ${data.name}`} className="max-w-xs" />
      </header>

      {auth.status === 'anonymous' && (
        <p role="status" className="bg-surface-sunken text-small text-text-muted rounded-md p-3">
          You are looking as a visitor.{' '}
          <Link href={`/login?next=${encodeURIComponent(base)}`} className="vd-link">
            Log in
          </Link>{' '}
          to submit solutions and keep track of your progress.
        </p>
      )}

      {data.collections.length === 0 ? (
        <EmptyState
          title="This Track has no Collections yet"
          description={
            abilities.canEditProblems
              ? 'Add Collections of problems to give it something to work through.'
              : 'Collections of problems will appear here once they are added.'
          }
          action={
            abilities.canEditProblems ? (
              <Link href={`${base}/edit`} className={buttonVariants({ variant: 'secondary' })}>
                Edit Track
              </Link>
            ) : undefined
          }
        />
      ) : (
        data.collections.map((collection) => (
          <CollectionSection key={collection.id} collection={collection} spaceSlug={space.slug} />
        ))
      )}
    </div>
  );
}

function CollectionSection({ collection, spaceSlug }: { collection: CollectionInTrack; spaceSlug: string }) {
  const { abilities } = useSpace();
  const headingId = `collection-${collection.id}`;
  const staff = abilities.canAuthorProblems;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={headingId} className="text-h3 break-words">
            {collection.name}
            {collection.archived && (
              <Badge tone="warning" className="ml-2 align-middle">
                Archived
              </Badge>
            )}
          </h3>
          {collection.description && <p className="text-small text-text-muted">{collection.description}</p>}
        </div>
        <ProgressMeter progress={collection.progress} label={`Progress in ${collection.name}`} className="min-w-40" />
      </div>
      {collection.problems.length === 0 ? (
        <p className="text-small text-text-muted">No problems in this Collection yet.</p>
      ) : (
        <ProblemRows
          problems={collection.problems}
          collectionName={collection.name}
          spaceSlug={spaceSlug}
          staff={staff}
          showResult={collection.problems.some((problem) => problem.my_result !== null)}
        />
      )}
    </section>
  );
}

function ProblemRows({
  problems,
  collectionName,
  spaceSlug,
  staff,
  showResult,
}: {
  problems: ProblemRef[];
  collectionName: string;
  spaceSlug: string;
  staff: boolean;
  showResult: boolean;
}) {
  return (
    <div className="vd-tablewrap">
      <table className="vd-table">
        <caption className="vd-sr">Problems in {collectionName}</caption>
        <thead>
          <tr>
            <th scope="col">Problem</th>
            {staff && <th scope="col">Status</th>}
            {showResult && <th scope="col">Your result</th>}
          </tr>
        </thead>
        <tbody>
          {problems.map((problem) => {
            const verdict = verdictOf(problem.my_result?.last_verdict ?? null);
            const href = `/spaces/${spaceSlug}/problems/${problem.slug}`;
            return (
              <ClickableRow key={problem.slug} href={href}>
                <td>
                  <Link href={href} className="vd-link">
                    {problem.title}
                  </Link>
                  <span className="text-mono-label text-text-muted mt-0.5 block">{problem.slug}</span>
                </td>
                {staff && (
                  <td>
                    <Badge
                      tone={
                        problem.status === 'published' ? 'brand' : problem.status === 'draft' ? 'warning' : 'neutral'
                      }
                    >
                      {PROBLEM_STATUS_LABELS[problem.status]}
                    </Badge>
                  </td>
                )}
                {showResult && (
                  <td>
                    {problem.my_result?.solved ? (
                      <VerdictBadge verdict="AC" detail="Solved" />
                    ) : verdict ? (
                      <VerdictBadge verdict={verdict} />
                    ) : (
                      <span className="text-text-muted text-small">Not tried</span>
                    )}
                  </td>
                )}
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
