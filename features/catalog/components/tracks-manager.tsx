'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SortableListOf } from '@/components/ui/sortable-list';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { errorMessage } from '@/lib/api';
import { useRefreshableQuery } from '@/lib/use-api-query';
import { catalogApi } from '../api/catalog.api';
import { PRIVACY_LABELS, trackPath, type TrackSummary } from '../types';
import { CreateDialog } from './create-dialog';
import { ManageGuard } from './manage-guard';

/** Create, reorder, archive and restore the Tracks of a Space. */
export function TracksManager() {
  return (
    <ManageGuard>
      <Manager />
    </ManageGuard>
  );
}

const getId = (track: TrackSummary) => track.slug;
const getLabel = (track: TrackSummary) => track.name;

function Manager() {
  const { space } = useSpace();
  const toast = useToast();
  const tracks = useRefreshableQuery(() => catalogApi.tracks(space.slug, true), `tracks-manage-${space.slug}`);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function restore(track: TrackSummary) {
    setBusy(track.slug);
    try {
      await catalogApi.updateTrack(space.slug, track.slug, { archived: false });
      toast({ tone: 'success', title: `Restored ${track.name}` });
      await tracks.refetch();
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not restore the Track', description: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  const active = tracks.status === 'success' ? tracks.data.filter((track) => !track.archived) : [];
  const archived = tracks.status === 'success' ? tracks.data.filter((track) => track.archived) : [];

  return (
    <section aria-labelledby="manage-tracks-heading" className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}/tracks`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <span>Manage</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="manage-tracks-heading" className="text-h2">
          Manage Tracks
        </h2>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New Track
        </Button>
      </div>

      {tracks.status === 'loading' && <Loading label="Loading Tracks" />}
      {tracks.status === 'error' && <ErrorState error={tracks.error} onRetry={tracks.reload} />}
      {tracks.status === 'success' && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-small text-text-muted max-w-[var(--measure)]">
              Solvers see the Tracks in this order. Drag a Track by its handle, or use its menu to move it up, down, to
              the top or to the bottom.
            </p>
            {active.length === 0 ? (
              <EmptyState title="No Tracks yet" description="Create a Track, then add Collections of problems to it." />
            ) : (
              <SortableListOf
                label="Tracks"
                items={active}
                getId={getId}
                getLabel={getLabel}
                onReorder={async (slugs) => {
                  try {
                    await catalogApi.reorderTracks(space.slug, slugs);
                  } catch (caught) {
                    // The list reports the failure itself. Another author may have changed the list: show what is there now.
                    void tracks.refetch().catch(() => undefined);
                    throw caught;
                  }
                  await tracks.refetch();
                }}
                renderItem={(track, context) => (
                  <div className="flex items-center gap-2 px-2 py-2">
                    {context.handle}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={trackPath(space.slug, track.slug)} className="vd-link break-words">
                        {track.name}
                      </Link>
                      <span className="text-small text-text-muted">
                        {track.collection_count} {track.collection_count === 1 ? 'Collection' : 'Collections'} ·{' '}
                        {track.problem_count} {track.problem_count === 1 ? 'problem' : 'problems'}
                      </span>
                    </span>
                    <Badge tone={track.privacy === 'members' ? 'info' : 'neutral'} className="hidden sm:inline-flex">
                      {PRIVACY_LABELS[track.privacy]}
                    </Badge>
                    <Link
                      href={`${trackPath(space.slug, track.slug)}/edit`}
                      className="vd-link"
                      aria-label={`Edit ${track.name}`}
                    >
                      Edit
                    </Link>
                    {context.moveMenu}
                  </div>
                )}
              />
            )}
          </div>

          {archived.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-h3">Archived Tracks</h3>
              <p className="text-small text-text-muted">
                Hidden from solvers. Their Collections and problems are kept.
              </p>
              <ul className="border-border bg-surface divide-border divide-y rounded-md border">
                {archived.map((track) => (
                  <li key={track.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <span className="text-body-strong break-words">{track.name}</span>
                    <Button
                      size="sm"
                      disabled={busy === track.slug}
                      aria-label={`Restore ${track.name}`}
                      onClick={() => restore(track)}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <CreateDialog
        kind="Track"
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (item) => {
          await catalogApi.createTrack(space.slug, {
            name: item.name,
            slug: item.slug || undefined,
            description: item.description,
            privacy: item.privacy,
          });
          await tracks.refetch();
        }}
      />
    </section>
  );
}
