'use client';

import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import { VISIBILITY_LABELS, type Track } from '../types';
import { ProgressBar } from './progress-bar';

/**
 * The front page of a Space: its Tracks (GRD-84). Solvers, outsiders and visitors reach problems
 * only through a Track they can see, so this is the way in for them; owners and editors also get
 * to the full problem list from the Problems tab.
 */
export function TrackOverview() {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const tracks = useApiQuery(() => tracksApi.list(space.slug), `tracks-${space.slug}-${auth.status}`);
  const base = `/spaces/${space.slug}`;

  return (
    <section aria-labelledby="tracks-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="tracks-heading" className="text-h2">
          Tracks
        </h2>
        {abilities.canAuthorProblems && (
          <Link href={`${base}/manage`} className={buttonVariants({ variant: 'secondary' })}>
            <Settings2 aria-hidden />
            Manage Tracks
          </Link>
        )}
      </div>

      {tracks.status === 'loading' && <Loading label="Loading Tracks" />}
      {tracks.status === 'error' && <ErrorState error={tracks.error} onRetry={tracks.reload} />}
      {tracks.status === 'success' &&
        (tracks.data.length === 0 ? (
          <EmptyState
            title="No Tracks you can see yet"
            description={
              abilities.canAuthorProblems
                ? 'Problems reach solvers through a Track. Create a Track, put a Collection of problems in it, and it will show here.'
                : auth.status === 'anonymous'
                  ? 'If you were invited to a Track in this Space, log in to see it.'
                  : 'Tracks in this Space will appear here. If you were invited to one, accept the invitation first.'
            }
            action={
              abilities.canAuthorProblems ? (
                <Link href={`${base}/manage`} className={buttonVariants({ variant: 'secondary' })}>
                  Manage Tracks
                </Link>
              ) : auth.status === 'anonymous' ? (
                <Link
                  href={`/login?next=${encodeURIComponent(base)}`}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  Log in
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tracks.data.map((track) => (
              <li key={track.id}>
                <TrackCard
                  track={track}
                  href={`${base}/tracks/${track.slug}`}
                  showPrivacy={abilities.canAuthorProblems}
                />
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

export function TrackCard({ track, href, showPrivacy }: { track: Track; href: string; showPrivacy: boolean }) {
  return (
    <Link href={href} className="vd-trackcard">
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-h3 break-words">{track.name}</span>
          {track.archived_at && <Badge>Archived</Badge>}
          {showPrivacy && track.visibility === 'members' && <Badge tone="info">{VISIBILITY_LABELS.members}</Badge>}
        </span>
        {track.description && <span className="text-small text-text-muted">{track.description}</span>}
      </span>
      <span className="text-small text-text-muted">
        {track.problem_count} {track.problem_count === 1 ? 'problem' : 'problems'} in {track.collection_count}{' '}
        {track.collection_count === 1 ? 'Collection' : 'Collections'}
      </span>
      {track.progress && track.progress.total > 0 && (
        <ProgressBar progress={track.progress} label={`Progress in ${track.name}`} />
      )}
    </Link>
  );
}
