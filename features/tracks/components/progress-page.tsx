'use client';

import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Dropdown } from '@/components/ui/dropdown';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useUrlQuery } from '@/lib/use-url-query';
import { tracksApi } from '../api/tracks.api';
import { ManagerGuard } from './manager-guard';
import { TrackProgress } from './track-progress';

// The chosen Track lives in the URL (?track=<slug>), so a link or a refresh shows the same Track.
const QUERY = { track: param.text() };

/** Member progress for owners and editors: pick a Track, see how far each solver has got. */
export function ProgressPage() {
  return <ManagerGuard>{() => <Progress />}</ManagerGuard>;
}

function Progress() {
  const { space } = useSpace();
  const tracks = useApiQuery(() => tracksApi.list(space.slug), `progress-tracks-${space.slug}`);
  const { values, set } = useUrlQuery(QUERY);

  if (tracks.status === 'loading') return <Loading label="Loading Tracks" />;
  if (tracks.status === 'error') return <ErrorState error={tracks.error} onRetry={tracks.reload} />;
  const active = tracks.data.filter((track) => !track.archived_at);
  if (active.length === 0) {
    return (
      <EmptyState
        title="No Tracks to show progress for"
        description="Create a Track first, then solvers can make progress in it."
      />
    );
  }
  const track = active.find((entry) => entry.slug === values.track) ?? active[0]!;
  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-4">
      <h2 id="progress-heading" className="text-h2">
        Member progress
      </h2>
      <Dropdown
        label="Track"
        className="max-w-xs"
        value={track.slug}
        options={active.map((entry) => ({ value: entry.slug, label: entry.name }))}
        onValueChange={(next) => set({ track: next })}
      />
      <TrackProgress key={track.slug} trackSlug={track.slug} trackName={track.name} />
    </section>
  );
}
