'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { SortableListOf } from '@/components/ui/sortable-list';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { useRefreshableQuery } from '@/lib/use-api-query';
import { catalogApi } from '../api/catalog.api';
import {
  PRIVACY_OPTIONS,
  collectionPath,
  trackPath,
  type CollectionInTrack,
  type TrackDetail,
  type TrackPrivacy,
} from '../types';
import { CreateDialog } from './create-dialog';
import { ManageGuard } from './manage-guard';

/** Edit one Track: its details and privacy, and which Collections it holds, in which order. */
export function TrackEditor() {
  return (
    <ManageGuard>
      <Editor />
    </ManageGuard>
  );
}

const getId = (collection: CollectionInTrack) => collection.slug;
const getLabel = (collection: CollectionInTrack) => collection.name;

function Editor() {
  const { space } = useSpace();
  const params = useParams<{ trackSlug: string }>();
  const trackSlug = params.trackSlug;
  const track = useRefreshableQuery(
    () => catalogApi.track(space.slug, trackSlug),
    `track-edit-${space.slug}-${trackSlug}`
  );

  if (track.status === 'loading') return <Loading label="Loading the Track" />;
  if (track.status === 'error') {
    const notFound = track.error instanceof ApiError && track.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Track not found"
        description="It may have been renamed or removed."
        action={
          <Link href={`/spaces/${space.slug}/tracks/edit`} className={buttonVariants({ variant: 'secondary' })}>
            Manage Tracks
          </Link>
        }
      />
    ) : (
      <ErrorState error={track.error} onRetry={track.reload} />
    );
  }
  return <TrackForms track={track.data} refetch={async () => void (await track.refetch())} />;
}

function TrackForms({ track, refetch }: { track: TrackDetail; refetch: () => Promise<void> }) {
  const { space } = useSpace();
  const base = trackPath(space.slug, track.slug);
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}/tracks`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <Link href={base} className="vd-link">
          {track.name}
        </Link>
        <span aria-hidden>/</span>
        <span>Edit</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-h2 break-words">Edit {track.name}</h2>
        <Link href={`${base}/members`} className={buttonVariants({ variant: 'secondary' })}>
          Members and invitations
        </Link>
      </div>
      <DetailsForm track={track} refetch={refetch} />
      <CollectionsSection track={track} refetch={refetch} />
    </div>
  );
}

function DetailsForm({ track, refetch }: { track: TrackDetail; refetch: () => Promise<void> }) {
  const { space } = useSpace();
  const toast = useToast();
  const [name, setName] = useState(track.name);
  const [description, setDescription] = useState(track.description);
  const [privacy, setPrivacy] = useState<TrackPrivacy>(track.privacy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [archiving, setArchiving] = useState(false);

  const dirty = name !== track.name || description !== track.description || privacy !== track.privacy;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await catalogApi.updateTrack(space.slug, track.slug, { name: name.trim(), description, privacy });
      toast({ tone: 'success', title: 'Track saved' });
      await refetch();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save the Track', description: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(archived: boolean) {
    setSaving(true);
    try {
      await catalogApi.updateTrack(space.slug, track.slug, { archived });
      toast({ tone: 'success', title: archived ? `Archived ${track.name}` : `Restored ${track.name}` });
      await refetch();
    } catch (caught) {
      toast({
        tone: 'danger',
        title: archived ? 'Could not archive the Track' : 'Could not restore the Track',
        description: errorMessage(caught),
      });
    } finally {
      setSaving(false);
      setArchiving(false);
    }
  }

  return (
    <section aria-labelledby="track-details-heading" className="flex max-w-[var(--measure)] flex-col gap-4">
      <h3 id="track-details-heading" className="text-h3">
        Details
      </h3>
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          error={error?.fieldError('name')}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Slug"
          mono
          value={track.slug}
          readOnly
          disabled
          hint="Part of the address of the Track. It cannot be changed."
        />
        <TextField
          label="Description"
          multiline
          rows={3}
          value={description}
          error={error?.fieldError('description')}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Dropdown
          label="Who can see it"
          value={privacy}
          options={PRIVACY_OPTIONS}
          error={error?.fieldError('privacy')}
          onValueChange={(next) => setPrivacy(next as TrackPrivacy)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!dirty || saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {track.archived ? (
            <Button type="button" disabled={saving} onClick={() => void setArchived(false)}>
              Restore Track
            </Button>
          ) : (
            <Button type="button" variant="destructive" disabled={saving} onClick={() => setArchiving(true)}>
              Archive Track
            </Button>
          )}
        </div>
      </form>
      <Dialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Archive “${track.name}”?`}
        description="Solvers can no longer open it. Its Collections and problems are kept, and you can restore the Track later."
        footer={
          <>
            <Button onClick={() => setArchiving(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void setArchived(true)} disabled={saving}>
              {saving ? 'Archiving…' : 'Archive Track'}
            </Button>
          </>
        }
      />
    </section>
  );
}

function CollectionsSection({ track, refetch }: { track: TrackDetail; refetch: () => Promise<void> }) {
  const { space } = useSpace();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [chosen, setChosen] = useState('');
  const [removing, setRemoving] = useState<CollectionInTrack | null>(null);
  const [busy, setBusy] = useState(false);
  const all = useRefreshableQuery(() => catalogApi.collections(space.slug), `collections-${space.slug}`);

  // Archived Collections cannot be part of the order Core takes; they are listed apart.
  const active = track.collections.filter((collection) => !collection.archived);
  const archived = track.collections.filter((collection) => collection.archived);
  const inTrack = new Set(track.collections.map((collection) => collection.slug));
  const available = all.status === 'success' ? all.data.filter((c) => !c.archived && !inTrack.has(c.slug)) : [];

  async function setCollections(slugs: string[]) {
    await catalogApi.setTrackCollections(space.slug, track.slug, slugs);
    await refetch();
    await all.refetch().catch(() => undefined);
  }

  async function add() {
    if (!chosen) return;
    setBusy(true);
    try {
      await setCollections([...active.map(getId), chosen]);
      setChosen('');
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not add the Collection', description: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await setCollections(active.filter((collection) => collection.slug !== removing.slug).map(getId));
      toast({ tone: 'neutral', title: `Removed ${removing.name} from the Track` });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not remove the Collection', description: errorMessage(caught) });
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  return (
    <section aria-labelledby="track-collections-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 id="track-collections-heading" className="text-h3">
          Collections in this Track
        </h3>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New Collection
        </Button>
      </div>
      <p className="text-small text-text-muted max-w-[var(--measure)]">
        Solvers work through the Collections in this order. A Collection can be part of several Tracks.
      </p>

      {active.length === 0 ? (
        <EmptyState
          title="No Collections yet"
          description="Create a Collection, or add one that already exists, to give this Track some problems."
        />
      ) : (
        <SortableListOf
          label="Collections in this Track"
          items={active}
          getId={getId}
          getLabel={getLabel}
          onReorder={async (slugs) => {
            try {
              await catalogApi.setTrackCollections(space.slug, track.slug, slugs);
            } catch (caught) {
              void refetch().catch(() => undefined);
              throw caught;
            }
            await refetch();
          }}
          renderItem={(collection, context) => (
            <div className="flex items-center gap-2 px-2 py-2">
              {context.handle}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body-strong break-words">{collection.name}</span>
                <span className="text-small text-text-muted">
                  {collection.problems.length} {collection.problems.length === 1 ? 'problem' : 'problems'}
                  {collection.problems.some((problem) => problem.status === 'draft') && ' · has drafts'}
                </span>
              </span>
              <Link
                href={`${collectionPath(space.slug, collection.slug)}/edit`}
                className="vd-link"
                aria-label={`Edit problems of ${collection.name}`}
              >
                Edit problems
              </Link>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${collection.name} from the Track`}
                disabled={busy}
                onClick={() => setRemoving(collection)}
              >
                Remove
              </Button>
              {context.moveMenu}
            </div>
          )}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Dropdown
          label="Add an existing Collection"
          placeholder={available.length === 0 ? 'No other Collections' : 'Choose a Collection'}
          value={chosen || undefined}
          options={available.map((collection) => ({ value: collection.slug, label: collection.name }))}
          disabled={available.length === 0 || busy}
          onValueChange={setChosen}
          className="w-64"
        />
        <Button disabled={!chosen || busy} onClick={() => void add()}>
          Add to Track
        </Button>
      </div>

      {archived.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-body-strong">Archived Collections</h4>
          <p className="text-small text-text-muted max-w-[var(--measure)]">
            Hidden from solvers and not part of the order. Saving a new order detaches them from this Track; restore a
            Collection from its page to keep it.
          </p>
          <ul className="text-small flex flex-col gap-1">
            {archived.map((collection) => (
              <li key={collection.id} className="flex items-center gap-2">
                <Link href={`${collectionPath(space.slug, collection.slug)}/edit`} className="vd-link">
                  {collection.name}
                </Link>
                <Badge tone="warning">Archived</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateDialog
        kind="Collection"
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (item) => {
          const created = await catalogApi.createCollection(space.slug, {
            name: item.name,
            slug: item.slug || undefined,
            description: item.description,
          });
          await setCollections([...active.map(getId), created.slug]);
        }}
      />
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove “${removing.name}” from this Track?` : 'Remove Collection?'}
        description="The Collection and its problems are kept, and stay in any other Track. Solvers no longer reach them through this one."
        footer={
          <>
            <Button onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy ? 'Removing…' : 'Remove from Track'}
            </Button>
          </>
        }
      />
    </section>
  );
}
