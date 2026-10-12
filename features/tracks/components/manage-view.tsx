'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SortableListOf } from '@/components/ui/sortable-list';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import { VISIBILITY_LABELS, type Track } from '../types';
import { NewCollectionDialog, NewTrackDialog } from './group-dialogs';
import { ManagerGuard } from './manager-guard';

/** Tracks and Collections of a Space: create, open, reorder, archive (GRD-83). Owners and editors only. */
export function ManageView() {
  return <ManagerGuard>{(editable) => <Manage editable={editable} />}</ManagerGuard>;
}

function Manage({ editable }: { editable: boolean }) {
  const { space } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const base = `/spaces/${space.slug}`;
  const tracks = useApiQuery(() => tracksApi.list(space.slug), `manage-tracks-${space.slug}`);
  const collections = useApiQuery(() => tracksApi.collections(space.slug), `manage-collections-${space.slug}`);
  const [dialog, setDialog] = useState<'track' | 'collection' | null>(null);

  async function restore(track: Track) {
    try {
      await tracksApi.restore(space.slug, track.slug);
      toast({ tone: 'success', title: `Restored ${track.name}` });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not restore the Track', description: errorMessage(caught) });
    } finally {
      tracks.reload();
    }
  }

  const active = tracks.status === 'success' ? tracks.data.filter((track) => !track.archived_at) : [];
  const archived = tracks.status === 'success' ? tracks.data.filter((track) => track.archived_at) : [];

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="manage-tracks" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="manage-tracks" className="text-h2">
              Tracks
            </h2>
            <p className="text-small text-text-muted max-w-[var(--measure)]">
              Solvers reach problems through Tracks. Drag to set the order they appear in.
            </p>
          </div>
          {editable && (
            <Button variant="secondary" onClick={() => setDialog('track')}>
              <Plus aria-hidden />
              New Track
            </Button>
          )}
        </div>
        {tracks.status === 'loading' && <Loading label="Loading Tracks" />}
        {tracks.status === 'error' && <ErrorState error={tracks.error} onRetry={tracks.reload} />}
        {tracks.status === 'success' && (
          <>
            {active.length === 0 ? (
              <EmptyState title="No active Tracks" description="Create a Track to give solvers a way in." />
            ) : (
              <SortableListOf
                items={active}
                label="Tracks in order"
                getId={(track) => track.id}
                getLabel={(track) => track.name}
                readOnly={!editable}
                onReorder={async (ids) => {
                  await tracksApi.reorder(space.slug, ids);
                  tracks.reload();
                }}
                renderItem={(track, { handle, moveMenu }) => (
                  <div className="flex items-center gap-2 px-3 py-2">
                    {handle}
                    <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={`${base}/manage/tracks/${track.slug}`}
                          className="vd-link text-body-strong break-words"
                        >
                          {track.name}
                        </Link>
                        <span className="text-mono-label text-text-muted">{track.slug}</span>
                      </span>
                      <span className="text-small text-text-muted flex flex-wrap items-center gap-2">
                        {track.visibility === 'members' && <Badge tone="info">{VISIBILITY_LABELS.members}</Badge>}
                        {track.collection_count} {track.collection_count === 1 ? 'Collection' : 'Collections'} ·{' '}
                        {track.problem_count} {track.problem_count === 1 ? 'problem' : 'problems'}
                      </span>
                    </span>
                    {moveMenu}
                  </div>
                )}
              />
            )}
            {archived.length > 0 && (
              <details className="border-border rounded-md border p-3">
                <summary className="text-body-strong cursor-pointer">Archived Tracks ({archived.length})</summary>
                <ul className="mt-3 flex flex-col gap-2">
                  {archived.map((track) => (
                    <li key={track.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-body">{track.name}</span>
                      {editable && (
                        <Button size="sm" onClick={() => restore(track)} aria-label={`Restore ${track.name}`}>
                          Restore
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="manage-collections" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="manage-collections" className="text-h2">
              Collections
            </h2>
            <p className="text-small text-text-muted max-w-[var(--measure)]">
              A Collection is a set of problems. It can sit in several Tracks, or in none (then only owners and editors
              see it).
            </p>
          </div>
          {editable && (
            <Button variant="secondary" onClick={() => setDialog('collection')}>
              <Plus aria-hidden />
              New Collection
            </Button>
          )}
        </div>
        {collections.status === 'loading' && <Loading label="Loading Collections" />}
        {collections.status === 'error' && <ErrorState error={collections.error} onRetry={collections.reload} />}
        {collections.status === 'success' &&
          (collections.data.length === 0 ? (
            <EmptyState
              title="No Collections yet"
              description="Create a Collection, add problems to it, then put it in a Track."
            />
          ) : (
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Collections</caption>
                <thead>
                  <tr>
                    <th scope="col">Collection</th>
                    <th scope="col" className="is-num">
                      Problems
                    </th>
                    <th scope="col">In Tracks</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.data.map((collection) => (
                    <tr key={collection.id}>
                      <td>
                        <Link href={`${base}/manage/collections/${collection.slug}`} className="vd-link">
                          {collection.name}
                        </Link>{' '}
                        {collection.archived_at && <Badge>Archived</Badge>}
                        <span className="text-mono-label text-text-muted vd-cell-sub">{collection.slug}</span>
                      </td>
                      <td className="is-num vd-mono">{collection.problems.length}</td>
                      <td className="vd-muted">
                        {collection.tracks && collection.tracks.length > 0
                          ? collection.tracks.map((track) => track.name).join(', ')
                          : 'None (owners and editors only)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      <NewTrackDialog
        open={dialog === 'track'}
        onClose={() => setDialog(null)}
        onCreated={(track) => {
          setDialog(null);
          router.push(`${base}/manage/tracks/${track.slug}`);
        }}
      />
      <NewCollectionDialog
        open={dialog === 'collection'}
        tracks={active}
        onClose={() => setDialog(null)}
        onCreated={(collection) => {
          setDialog(null);
          router.push(`${base}/manage/collections/${collection.slug}`);
        }}
      />
    </div>
  );
}
