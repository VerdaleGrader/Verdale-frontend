'use client';

import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import { ProgressBar } from './progress-bar';

/** How far each solver who can see the Track has got. Owners and editors only. */
export function TrackProgress({ trackSlug, trackName }: { trackSlug: string; trackName: string }) {
  const { space } = useSpace();
  const progress = useApiQuery(
    () => tracksApi.memberProgress(space.slug, trackSlug),
    `track-progress-${space.slug}-${trackSlug}`
  );
  if (progress.status === 'loading') return <Loading label="Loading progress" />;
  if (progress.status === 'error') return <ErrorState error={progress.error} onRetry={progress.reload} />;
  if (progress.data.length === 0) {
    return (
      <EmptyState
        title="No solvers to show"
        description="Solvers who can see this Track appear here with how many of its problems they have passed."
      />
    );
  }
  const collections = progress.data[0]?.collections ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-muted max-w-[var(--measure)]">
        A problem counts as passed after at least one accepted submission, on any version. Only published problems
        count.
      </p>
      <div className="vd-tablewrap">
        <table className="vd-table">
          <caption className="vd-sr">Progress in {trackName}</caption>
          <thead>
            <tr>
              <th scope="col">Solver</th>
              <th scope="col">Track</th>
              {collections.map((collection) => (
                <th key={collection.id} scope="col" className="is-num">
                  {collection.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {progress.data.map((row) => (
              <tr key={row.user.username}>
                <td>
                  <span className="vd-inline">
                    <Avatar name={row.user.display_name} src={row.user.avatar_url} size="md" />
                    <span className="flex flex-col gap-1">
                      <span className="text-body-strong">{row.user.display_name}</span>
                      <span className="text-mono-label text-text-muted">{row.user.username}</span>
                    </span>
                  </span>
                </td>
                <td className="min-w-40">
                  <ProgressBar progress={row.progress} label={`${row.user.username} in ${trackName}`} />
                </td>
                {row.collections.map((collection) => (
                  <td key={collection.id} className="is-num vd-mono">
                    {collection.progress.solved}/{collection.progress.total}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
