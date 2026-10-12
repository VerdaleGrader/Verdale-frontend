'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Eye } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransferLists } from '@/components/ui/transfer-lists';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { param, useUrlQuery } from '@/lib/use-url-query';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import { VISIBILITY_LABELS, type TrackDetail, type TrackVisibility } from '../types';
import { SLUG_HINT, VISIBILITY_OPTIONS, VisibilityExplanation } from './group-dialogs';
import { ManagerGuard } from './manager-guard';
import { TrackAccess } from './track-access';
import { TrackProgress } from './track-progress';

interface CollectionItem {
  id: string;
  slug: string;
  name: string;
  problemCount: number;
  archived: boolean;
}

const TABS = ['collections', 'settings', 'access', 'progress'] as const;
type TrackTab = (typeof TABS)[number];

// The open section lives in the URL (?tab=settings); the default is left out.
const QUERY = { tab: param.oneOf(TABS, 'collections') };

/** Edit one Track: its Collections and their order, its settings and privacy, who may enter, and how far they have got. */
export function TrackEditor() {
  return <ManagerGuard>{(editable) => <Editor editable={editable} />}</ManagerGuard>;
}

function Editor({ editable }: { editable: boolean }) {
  const { space } = useSpace();
  const params = useParams<{ trackSlug: string }>();
  const base = `/spaces/${space.slug}`;
  const track = useApiQuery(
    () => tracksApi.get(space.slug, params.trackSlug),
    `edit-track-${space.slug}-${params.trackSlug}`
  );
  const everything = useApiQuery(() => tracksApi.collections(space.slug), `edit-track-collections-${space.slug}`);
  const [latest, setLatest] = useState<TrackDetail | null>(null);
  const { values, set } = useUrlQuery(QUERY);
  const tab = values.tab;

  if (track.status === 'loading' || everything.status === 'loading') return <Loading label="Loading the Track" />;
  if (track.status === 'error') {
    const notFound = track.error instanceof ApiError && track.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Track not found"
        description="It may have been renamed, or the address is wrong."
        action={
          <Link href={`${base}/manage`} className={buttonVariants({ variant: 'secondary' })}>
            Back to Tracks
          </Link>
        }
      />
    ) : (
      <ErrorState error={track.error} onRetry={track.reload} />
    );
  }
  if (everything.status === 'error') return <ErrorState error={everything.error} onRetry={everything.reload} />;

  const data = latest && latest.id === track.data.id ? latest : track.data;
  const inside = new Set(data.collections.map((collection) => collection.id));
  const selected: CollectionItem[] = data.collections.map((collection) => ({
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    problemCount: collection.problems.length,
    archived: collection.archived_at !== null,
  }));
  const available: CollectionItem[] = everything.data
    .filter((collection) => !inside.has(collection.id))
    .map((collection) => ({
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      problemCount: collection.problems.length,
      archived: collection.archived_at !== null,
    }));
  const slugOf = (ids: string[]) =>
    ids.flatMap((id) => {
      const found = [...available, ...selected].find((item) => item.id === id);
      return found ? [found.slug] : [];
    });

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`${base}/manage`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <span>{data.name}</span>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-h1 break-words">{data.name}</h2>
          <span className="flex flex-wrap gap-1.5">
            {data.archived_at && <Badge>Archived</Badge>}
            <Badge tone={data.visibility === 'members' ? 'info' : 'neutral'}>
              {VISIBILITY_LABELS[data.visibility]}
            </Badge>
          </span>
        </div>
        <Link href={`${base}/tracks/${data.slug}`} className={buttonVariants({ variant: 'secondary' })}>
          <Eye aria-hidden />
          View as solver
        </Link>
      </header>

      <Tabs value={tab} onValueChange={(next) => set({ tab: next as TrackTab })} className="flex flex-col gap-6">
        <TabsList aria-label="Track sections">
          <TabsTrigger value="collections" count={data.collections.length}>
            Collections
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="access">Members and invitations</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="flex flex-col gap-3">
          <p className="text-small text-text-muted max-w-[var(--measure)]">
            The Collections solvers see in this Track, in this order. A Collection can be in several Tracks; taking it
            out here does not delete it.
          </p>
          <TransferLists
            available={available}
            selected={selected}
            availableLabel="Not in this Track"
            selectedLabel="In this Track"
            disabled={!editable}
            itemLabel={(item) => item.name}
            searchText={(item) => `${item.name} ${item.slug}`}
            renderItem={(item) => (
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`${base}/manage/collections/${item.slug}`}
                    className="vd-link text-body-strong break-words"
                  >
                    {item.name}
                  </Link>
                  <span className="text-mono-label text-text-muted">{item.slug}</span>
                </span>
                <span className="text-small text-text-muted flex items-center gap-2">
                  {item.archived && <Badge>Archived</Badge>}
                  {item.problemCount} {item.problemCount === 1 ? 'problem' : 'problems'}
                </span>
              </span>
            )}
            onAdd={async (ids) => setLatest(await tracksApi.addCollections(space.slug, data.slug, slugOf(ids)))}
            onRemove={async (ids) => setLatest(await tracksApi.removeCollections(space.slug, data.slug, slugOf(ids)))}
            onReorder={async (ids) => setLatest(await tracksApi.reorderCollections(space.slug, data.slug, ids))}
          />
        </TabsContent>

        <TabsContent value="settings">
          <TrackSettings
            track={data}
            editable={editable}
            onChanged={(next) => {
              setLatest(next);
              if (next.slug !== data.slug) {
                window.history.replaceState(null, '', `${base}/manage/tracks/${next.slug}`);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="access">
          <TrackAccess trackSlug={data.slug} trackName={data.name} editable={editable} />
        </TabsContent>

        <TabsContent value="progress">
          <TrackProgress trackSlug={data.slug} trackName={data.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrackSettings({
  track,
  editable,
  onChanged,
}: {
  track: TrackDetail;
  editable: boolean;
  onChanged: (next: TrackDetail) => void;
}) {
  const { space } = useSpace();
  const toast = useToast();
  const [edits, setEdits] = useState<{
    name?: string;
    slug?: string;
    description?: string;
    visibility?: TrackVisibility;
  }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const value = {
    name: edits.name ?? track.name,
    slug: edits.slug ?? track.slug,
    description: edits.description ?? track.description,
    visibility: edits.visibility ?? track.visibility,
  };
  const changed =
    value.name.trim() !== track.name ||
    value.slug !== track.slug ||
    value.description.trim() !== track.description ||
    value.visibility !== track.visibility;
  const slugError = error?.fieldError('slug') ?? (error?.status === 409 ? error.message : undefined);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const next = await tracksApi.update(space.slug, track.slug, {
        name: value.name.trim(),
        slug: value.slug,
        description: value.description.trim(),
        visibility: value.visibility,
      });
      setEdits({});
      toast({ tone: 'success', title: 'Track saved' });
      onChanged(next);
    } catch (caught) {
      if (caught instanceof ApiError && [400, 409].includes(caught.status)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save', description: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    setSaving(true);
    try {
      const next = track.archived_at
        ? await tracksApi.restore(space.slug, track.slug)
        : await tracksApi.archive(space.slug, track.slug);
      toast({ tone: 'success', title: track.archived_at ? 'Track restored' : 'Track archived' });
      onChanged(next);
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not change the Track', description: errorMessage(caught) });
    } finally {
      setSaving(false);
      setConfirmArchive(false);
    }
  }

  return (
    <section aria-label="Track settings" className="flex max-w-[var(--measure)] flex-col gap-4">
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          value={value.name}
          maxLength={80}
          disabled={!editable}
          error={error?.fieldError('name')}
          onChange={(event) => setEdits((current) => ({ ...current, name: event.target.value }))}
        />
        <TextField
          label="Slug"
          mono
          value={value.slug}
          maxLength={64}
          disabled={!editable}
          hint={`${SLUG_HINT} Changing it changes the address of this Track.`}
          error={slugError}
          onChange={(event) => setEdits((current) => ({ ...current, slug: event.target.value.toLowerCase() }))}
        />
        <TextField
          label="Description"
          multiline
          rows={3}
          value={value.description}
          maxLength={500}
          disabled={!editable}
          error={error?.fieldError('description')}
          onChange={(event) => setEdits((current) => ({ ...current, description: event.target.value }))}
        />
        <Dropdown
          label="Who can see this Track"
          value={value.visibility}
          options={VISIBILITY_OPTIONS}
          disabled={!editable}
          onValueChange={(next) => setEdits((current) => ({ ...current, visibility: next as TrackVisibility }))}
        />
        <VisibilityExplanation value={value.visibility} />
        {value.visibility !== track.visibility && (
          <p role="status" className="bg-warning-soft text-warning text-small rounded-md p-3">
            {value.visibility === 'members'
              ? 'After you save, people who were not added to this Track stop seeing it and its problems. Owners and editors are not affected.'
              : 'After you save, everyone who can see the Space can see this Track and its problems.'}
          </p>
        )}
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving || !changed || !value.name.trim()}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => (track.archived_at ? void toggleArchive() : setConfirmArchive(true))}
            >
              {track.archived_at ? 'Restore Track' : 'Archive Track'}
            </Button>
          </div>
        )}
      </form>
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={`Archive “${track.name}”?`}
        description="Solvers stop seeing this Track. Its Collections and problems are not deleted, and you can restore it."
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={toggleArchive} disabled={saving}>
              {saving ? 'Archiving…' : 'Archive Track'}
            </Button>
          </>
        }
      />
    </section>
  );
}
