'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { TransferLists } from '@/components/ui/transfer-lists';
import { useToast } from '@/components/ui/toast';
import { problemsApi } from '@/features/problems/api/problems.api';
import { STATUS_LABELS, type ProblemStatus } from '@/features/problems/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import type { CollectionDetail } from '../types';
import { SLUG_HINT } from './group-dialogs';
import { ManagerGuard } from './manager-guard';

interface ProblemItem {
  id: string;
  slug: string;
  title: string;
  status: ProblemStatus;
}

const STATUS_TONE: Record<ProblemStatus, 'warning' | 'neutral' | 'brand'> = {
  draft: 'warning',
  archived: 'neutral',
  published: 'brand',
};

/** Edit one Collection: its details, and which problems are in it and in what order (GRD-83). */
export function CollectionEditor() {
  return <ManagerGuard>{(editable) => <Editor editable={editable} />}</ManagerGuard>;
}

function Editor({ editable }: { editable: boolean }) {
  const { space } = useSpace();
  const params = useParams<{ collectionSlug: string }>();
  const base = `/spaces/${space.slug}`;
  const collection = useApiQuery(
    () => tracksApi.collection(space.slug, params.collectionSlug),
    `collection-${space.slug}-${params.collectionSlug}`
  );
  const everything = useApiQuery(() => problemsApi.listAll(space.slug), `all-problems-${space.slug}`);
  // A fresher copy than the query's, set after every change so the lists never wait for a reload.
  const [latest, setLatest] = useState<CollectionDetail | null>(null);

  if (collection.status === 'loading' || everything.status === 'loading')
    return <Loading label="Loading the Collection" />;
  if (collection.status === 'error') {
    const notFound = collection.error instanceof ApiError && collection.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Collection not found"
        description="It may have been renamed, or the address is wrong."
        action={
          <Link href={`${base}/manage`} className={buttonVariants({ variant: 'secondary' })}>
            Back to Tracks
          </Link>
        }
      />
    ) : (
      <ErrorState error={collection.error} onRetry={collection.reload} />
    );
  }
  if (everything.status === 'error') return <ErrorState error={everything.error} onRetry={everything.reload} />;

  const data = latest && latest.id === collection.data.id ? latest : collection.data;
  const inside = new Set(data.problems.map((problem) => problem.id));
  const selected: ProblemItem[] = data.problems.map((problem) => ({
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    status: problem.status,
  }));
  const available: ProblemItem[] = everything.data
    .filter((problem) => !inside.has(problem.id))
    .map((problem) => ({ id: problem.id, slug: problem.slug, title: problem.title, status: problem.status }));
  const slugOf = (ids: string[]) =>
    ids.flatMap((id) => {
      const found = [...available, ...selected].find((problem) => problem.id === id);
      return found ? [found.slug] : [];
    });

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`${base}/manage`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <span>{data.name}</span>
      </nav>
      <header className="flex flex-col gap-2">
        <h2 className="text-h1 break-words">{data.name}</h2>
        <span className="flex flex-wrap gap-1.5">
          {data.archived_at && <Badge>Archived</Badge>}
          <Badge tone="info">
            In {data.tracks?.length ?? 0} {data.tracks?.length === 1 ? 'Track' : 'Tracks'}
          </Badge>
        </span>
        {data.tracks && data.tracks.length === 0 && (
          <p className="text-small text-text-muted">
            This Collection is in no Track, so solvers cannot see it. Add it to a Track from the Track’s page.
          </p>
        )}
      </header>

      <DetailsForm
        collection={data}
        editable={editable}
        onChanged={(next, renamed) => {
          setLatest(next);
          if (renamed) window.history.replaceState(null, '', `${base}/manage/collections/${next.slug}`);
        }}
      />

      <section aria-labelledby="problems-heading" className="flex flex-col gap-3">
        <h3 id="problems-heading" className="text-h2">
          Problems
        </h3>
        <p className="text-small text-text-muted max-w-[var(--measure)]">
          Drafts can be added; solvers see a problem only once it is published. A problem can be in many Collections,
          and taking it out here does not delete it.
        </p>
        <TransferLists
          available={available}
          selected={selected}
          availableLabel="Not in this Collection"
          selectedLabel="In this Collection"
          disabled={!editable}
          itemLabel={(problem) => problem.title}
          searchText={(problem) => `${problem.title} ${problem.slug}`}
          renderItem={(problem) => (
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-body-strong break-words">{problem.title}</span>
                <span className="text-mono-label text-text-muted">{problem.slug}</span>
              </span>
              {problem.status !== 'published' && (
                <Badge tone={STATUS_TONE[problem.status]}>{STATUS_LABELS[problem.status]}</Badge>
              )}
            </span>
          )}
          onAdd={async (ids) => setLatest(await tracksApi.addProblems(space.slug, data.slug, slugOf(ids)))}
          onRemove={async (ids) => setLatest(await tracksApi.removeProblems(space.slug, data.slug, slugOf(ids)))}
          onReorder={async (ids) => setLatest(await tracksApi.reorderProblems(space.slug, data.slug, ids))}
        />
      </section>
    </div>
  );
}

function DetailsForm({
  collection,
  editable,
  onChanged,
}: {
  collection: CollectionDetail;
  editable: boolean;
  onChanged: (next: CollectionDetail, renamed: boolean) => void;
}) {
  const { space } = useSpace();
  const toast = useToast();
  const [edits, setEdits] = useState<{ name?: string; slug?: string; description?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const value = {
    name: edits.name ?? collection.name,
    slug: edits.slug ?? collection.slug,
    description: edits.description ?? collection.description,
  };
  const changed =
    value.name.trim() !== collection.name ||
    value.slug !== collection.slug ||
    value.description.trim() !== collection.description;
  const slugError = error?.fieldError('slug') ?? (error?.status === 409 ? error.message : undefined);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const next = await tracksApi.updateCollection(space.slug, collection.slug, {
        name: value.name.trim(),
        slug: value.slug,
        description: value.description.trim(),
      });
      setEdits({});
      toast({ tone: 'success', title: 'Collection saved' });
      onChanged(next, next.slug !== collection.slug);
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
      const next = collection.archived_at
        ? await tracksApi.restoreCollection(space.slug, collection.slug)
        : await tracksApi.archiveCollection(space.slug, collection.slug);
      toast({ tone: 'success', title: collection.archived_at ? 'Collection restored' : 'Collection archived' });
      onChanged(next, false);
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not change the Collection', description: errorMessage(caught) });
    } finally {
      setSaving(false);
      setConfirmArchive(false);
    }
  }

  return (
    <section aria-labelledby="details-heading" className="flex max-w-[var(--measure)] flex-col gap-4">
      <h3 id="details-heading" className="text-h2">
        Details
      </h3>
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
          hint={`${SLUG_HINT} Changing it changes the address of this page.`}
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
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving || !changed || !value.name.trim()}>
              {saving ? 'Saving…' : 'Save details'}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => (collection.archived_at ? void toggleArchive() : setConfirmArchive(true))}
            >
              {collection.archived_at ? 'Restore Collection' : 'Archive Collection'}
            </Button>
          </div>
        )}
      </form>
      <Dialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={`Archive “${collection.name}”?`}
        description="Solvers stop seeing the Collection and the problems that are only reachable through it. Nothing is deleted, and you can restore it."
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={toggleArchive} disabled={saving}>
              {saving ? 'Archiving…' : 'Archive Collection'}
            </Button>
          </>
        }
      />
    </section>
  );
}
