'use client';

import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Select } from '@/components/ui/field';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import { ManagerGuard } from './manager-guard';
import { TrackProgress } from './track-progress';

/** Member progress for owners and editors: pick a Track, see how far each solver has got. */
export function ProgressPage() {
  return <ManagerGuard>{() => <Progress />}</ManagerGuard>;
}

function Progress() {
  const { space } = useSpace();
  const tracks = useApiQuery(() => tracksApi.list(space.slug), `progress-tracks-${space.slug}`);
  const [chosen, setChosen] = useState<string>();

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
  const track = active.find((entry) => entry.slug === chosen) ?? active[0]!;
  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-4">
      <h2 id="progress-heading" className="text-h2">
        Member progress
      </h2>
      <Select
        label="Track"
        className="max-w-xs"
        value={track.slug}
        options={active.map((entry) => ({ value: entry.slug, label: entry.name }))}
        onChange={(event) => setChosen(event.target.value)}
      />
      <TrackProgress key={track.slug} trackSlug={track.slug} trackName={track.name} />
    </section>
  );
}
