'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ROLE_LABELS, type Role } from '@/features/spaces/types';
import { useApiQuery } from '@/lib/use-api-query';
import { catalogApi } from '../api/catalog.api';
import { ProgressMeter } from './progress-meter';

/** How far each person who can reach the Track has got. For the Space's staff. */
export function TrackProgressView() {
  const { space, abilities } = useSpace();
  const params = useParams<{ trackSlug: string }>();
  if (!abilities.canReviewSubmissions) {
    const back = `/spaces/${space.slug}/tracks/${params.trackSlug}`;
    return (
      <EmptyState
        title="Progression is for the Space’s staff"
        description="Owners, administrators, editors and observers can see how far members have got."
        action={
          <Link href={back} className={buttonVariants({ variant: 'secondary' })}>
            Back to the Track
          </Link>
        }
      />
    );
  }
  return <ProgressionTable />;
}

function ProgressionTable() {
  const { space } = useSpace();
  const params = useParams<{ trackSlug: string }>();
  const progress = useApiQuery(
    () => catalogApi.trackProgress(space.slug, params.trackSlug),
    `track-progress-${space.slug}-${params.trackSlug}`
  );
  const back = `/spaces/${space.slug}/tracks/${params.trackSlug}`;

  return (
    <section aria-labelledby="progression-heading" className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}/tracks`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <Link href={back} className="vd-link">
          {params.trackSlug}
        </Link>
        <span aria-hidden>/</span>
        <span>Progression</span>
      </nav>
      <h2 id="progression-heading" className="text-h2">
        Progression
      </h2>
      <p className="text-small text-text-muted max-w-[var(--measure)]">
        Problems solved by everyone who can reach this Track: the people added to it and, when it is open to the Space,
        the Space’s solvers. A problem counts once, whichever version was solved.
      </p>

      {progress.status === 'loading' && <Loading label="Loading progression" />}
      {progress.status === 'error' && <ErrorState error={progress.error} onRetry={progress.reload} />}
      {progress.status === 'success' &&
        (progress.data.items.length === 0 ? (
          <EmptyState
            title="Nobody to show yet"
            description="Add people to a members-only Track, or wait for solvers to join the Space."
          />
        ) : (
          <div className="vd-tablewrap">
            <table className="vd-table">
              <caption className="vd-sr">Progression in {params.trackSlug}</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Solved</th>
                </tr>
              </thead>
              <tbody>
                {progress.data.items.map((item) => (
                  <tr key={item.user.username}>
                    <td>
                      <span className="vd-inline">
                        <Avatar name={item.user.display_name} src={item.user.avatar_url} size="md" />
                        <span className="flex flex-col gap-0.5 leading-tight">
                          <span className="text-body-strong">{item.user.display_name}</span>
                          <span className="text-mono-label text-text-muted">{item.user.username}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {item.role ? ROLE_LABELS[item.role as Role] : 'Not a member'}
                        {item.is_track_member && <Badge tone="brand">Added to the Track</Badge>}
                      </span>
                    </td>
                    <td>
                      <ProgressMeter
                        progress={{ solved: item.solved, total: progress.data.total }}
                        label={`Progress of ${item.user.username}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
