'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { SortableLists, type SortableGroup } from '@/components/ui/sortable-list';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { useApiQuery, useRefreshableQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { catalogApi, MAX_PICKER_PROBLEMS } from '../api/catalog.api';
import { PROBLEM_STATUS_LABELS, trackPath, type CollectionDetail, type ProblemRef } from '../types';
import { ManageGuard } from './manage-guard';

/** Edit one Collection: its details, and which problems it holds, in which order. */
export function CollectionEditor() {
  return (
    <ManageGuard>
      <Editor />
    </ManageGuard>
  );
}

const STATUSES = ['all', 'published', 'draft', 'archived'] as const;

// Search and status of the problems still to add live in the URL (?q=…&status=draft); defaults are left out.
const QUERY = { q: param.text(), status: param.oneOf(STATUSES, 'all') };

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

type Row = Pick<ProblemRef, 'slug' | 'title' | 'status'>;
const getId = (row: Row) => row.slug;
const getLabel = (row: Row) => row.title;

const IN = 'in';
const OUT = 'out';

const TONE = { published: 'brand', draft: 'warning', archived: 'neutral' } as const;

function Editor() {
  const { space } = useSpace();
  const params = useParams<{ collectionSlug: string }>();
  const collectionSlug = params.collectionSlug;
  const collection = useRefreshableQuery(
    () => catalogApi.collection(space.slug, collectionSlug),
    `collection-edit-${space.slug}-${collectionSlug}`
  );

  if (collection.status === 'loading') return <Loading label="Loading the Collection" />;
  if (collection.status === 'error') {
    const notFound = collection.error instanceof ApiError && collection.error.status === 404;
    return notFound ? (
      <EmptyState
        title="Collection not found"
        description="It may have been renamed or removed."
        action={
          <Link href={`/spaces/${space.slug}/tracks`} className={buttonVariants({ variant: 'secondary' })}>
            Back to Tracks
          </Link>
        }
      />
    ) : (
      <ErrorState error={collection.error} onRetry={collection.reload} />
    );
  }
  const refetch = async () => void (await collection.refetch());
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}/tracks`} className="vd-link">
          Tracks
        </Link>
        {collection.data.tracks.map((track) => (
          <span key={track.slug} className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            <Link href={trackPath(space.slug, track.slug)} className="vd-link">
              {track.name}
            </Link>
          </span>
        ))}
        <span aria-hidden>/</span>
        <span>{collection.data.name}</span>
      </nav>
      <h2 className="text-h2 break-words">Edit {collection.data.name}</h2>
      <DetailsForm collection={collection.data} refetch={refetch} />
      <ProblemsSection collection={collection.data} refetch={refetch} />
    </div>
  );
}

function DetailsForm({ collection, refetch }: { collection: CollectionDetail; refetch: () => Promise<void> }) {
  const { space } = useSpace();
  const toast = useToast();
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [archiving, setArchiving] = useState(false);
  const dirty = name !== collection.name || description !== collection.description;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await catalogApi.updateCollection(space.slug, collection.slug, { name: name.trim(), description });
      toast({ tone: 'success', title: 'Collection saved' });
      await refetch();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save the Collection', description: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(archived: boolean) {
    setSaving(true);
    try {
      await catalogApi.updateCollection(space.slug, collection.slug, { archived });
      toast({ tone: 'success', title: archived ? `Archived ${collection.name}` : `Restored ${collection.name}` });
      await refetch();
    } catch (caught) {
      toast({
        tone: 'danger',
        title: archived ? 'Could not archive the Collection' : 'Could not restore the Collection',
        description: errorMessage(caught),
      });
    } finally {
      setSaving(false);
      setArchiving(false);
    }
  }

  return (
    <section aria-labelledby="collection-details-heading" className="flex max-w-[var(--measure)] flex-col gap-4">
      <h3 id="collection-details-heading" className="text-h3">
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
        <TextField label="Slug" mono value={collection.slug} readOnly disabled hint="It cannot be changed." />
        <TextField
          label="Description"
          multiline
          rows={3}
          value={description}
          error={error?.fieldError('description')}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!dirty || saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {collection.archived ? (
            <Button type="button" disabled={saving} onClick={() => void setArchived(false)}>
              Restore Collection
            </Button>
          ) : (
            <Button type="button" variant="destructive" disabled={saving} onClick={() => setArchiving(true)}>
              Archive Collection
            </Button>
          )}
        </div>
      </form>
      <Dialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Archive “${collection.name}”?`}
        description="Solvers no longer reach it or its problems through any Track. The problems are kept, and you can restore the Collection later."
        footer={
          <>
            <Button onClick={() => setArchiving(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void setArchived(true)} disabled={saving}>
              {saving ? 'Archiving…' : 'Archive Collection'}
            </Button>
          </>
        }
      />
    </section>
  );
}

function ProblemsSection({ collection, refetch }: { collection: CollectionDetail; refetch: () => Promise<void> }) {
  const { space } = useSpace();
  const toast = useToast();
  const { values, set } = useUrlQuery(QUERY);
  const [input, setInput] = useDebouncedText(values.q, (text) => set({ q: text }));
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const everything = useApiQuery(
    () => catalogApi.allProblems(space.slug, { q: values.q, status: values.status }),
    `collection-picker-${space.slug}-${values.q}-${values.status}`
  );

  const inRows: Row[] = collection.problems;
  const inSlugs = new Set(inRows.map(getId));
  const outRows: Row[] =
    everything.status === 'success' ? everything.data.items.filter((p) => !inSlugs.has(p.slug)) : [];
  const picked = (rows: Row[]) => rows.filter((row) => selected.has(row.slug));

  const lists: SortableGroup<Row>[] = [
    { id: OUT, label: 'Problems not in this Collection', items: outRows },
    { id: IN, label: 'Problems in this Collection', items: inRows },
  ];

  function toggle(slug: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  function toggleAll(rows: Row[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of rows) {
        if (on) next.add(row.slug);
        else next.delete(row.slug);
      }
      return next;
    });
  }

  async function change(change: { add?: string[]; remove?: string[] }, done: string) {
    setBusy(true);
    try {
      await catalogApi.changeCollectionProblems(space.slug, collection.slug, change);
      setSelected(new Set());
      toast({ tone: 'success', title: done });
      await refetch();
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not change the Collection', description: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  const toAdd = picked(outRows);
  const toRemove = picked(inRows);
  const count = (n: number) => `${n} ${n === 1 ? 'problem' : 'problems'}`;

  return (
    <section aria-labelledby="collection-problems-heading" className="flex flex-col gap-4">
      <h3 id="collection-problems-heading" className="text-h3">
        Problems
      </h3>
      <p className="text-small text-text-muted max-w-[var(--measure)]">
        Drag problems between the lists, or tick several and use the buttons. Drafts can be added: solvers do not see
        them until they are published. Drag within the right-hand list to set the order solvers follow.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          type="search"
          label="Search problems to add"
          placeholder="Title or slug"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full max-w-xs"
        />
        <Dropdown
          label="Status"
          value={values.status}
          options={STATUS_OPTIONS}
          onValueChange={(next) => set({ status: next as (typeof STATUSES)[number] })}
          className="w-44"
        />
        <Button
          disabled={toAdd.length === 0 || busy}
          onClick={() => void change({ add: toAdd.map(getId) }, `Added ${count(toAdd.length)}`)}
        >
          <ArrowRight aria-hidden />
          Add selected ({toAdd.length})
        </Button>
        <Button
          disabled={toRemove.length === 0 || busy}
          onClick={() => void change({ remove: toRemove.map(getId) }, `Removed ${count(toRemove.length)}`)}
        >
          <ArrowLeft aria-hidden />
          Remove selected ({toRemove.length})
        </Button>
      </div>

      {everything.status === 'loading' && <Loading label="Loading problems" />}
      {everything.status === 'error' && <ErrorState error={everything.error} onRetry={everything.reload} />}
      {everything.status === 'success' && (
        <>
          {everything.data.total > MAX_PICKER_PROBLEMS && (
            <p role="status" className="bg-warning-soft text-warning text-small rounded-md p-3">
              This Space has more than {MAX_PICKER_PROBLEMS} matching problems. Narrow the search to see the rest.
            </p>
          )}
          <SortableLists
            lists={lists}
            columns
            getId={getId}
            getLabel={getLabel}
            emptyLabel="Nothing here"
            listHeader={(list, total) => {
              const rows = list.id === IN ? inRows : outRows;
              const all = rows.length > 0 && rows.every((row) => selected.has(row.slug));
              return (
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-body-strong">
                    {list.id === IN ? 'In this Collection' : 'Not in this Collection'}{' '}
                    <span className="text-text-muted vd-mono">{total}</span>
                  </h4>
                  {rows.length > 0 && (
                    <Checkbox
                      label="Select all"
                      checked={all}
                      onCheckedChange={(on) => toggleAll(rows, on === true)}
                      aria-label={`Select all problems ${list.id === IN ? 'in' : 'not in'} this Collection`}
                    />
                  )}
                </div>
              );
            }}
            onReorder={async (order, change) => {
              // The right-hand order is the Collection's order; the left-hand one is only how the list is shown.
              if (change.from === OUT && change.to === OUT) return;
              try {
                await catalogApi.setCollectionProblems(space.slug, collection.slug, order[IN] ?? []);
              } catch (caught) {
                toast({ tone: 'danger', title: 'Could not change the Collection', description: errorMessage(caught) });
                void refetch().catch(() => undefined);
                throw caught;
              }
              setSelected(new Set());
              await refetch();
            }}
            renderItem={(row, context) => (
              <div className="flex items-center gap-2 px-2 py-2">
                {context.handle}
                <Checkbox
                  label={
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words">{row.title}</span>
                      <span className="text-mono-label text-text-muted">{row.slug}</span>
                    </span>
                  }
                  checked={selected.has(row.slug)}
                  onCheckedChange={(on) => toggle(row.slug, on === true)}
                  className="min-w-0 flex-1"
                />
                <Badge tone={TONE[row.status]}>{PROBLEM_STATUS_LABELS[row.status]}</Badge>
                {context.moveMenu}
              </div>
            )}
          />
        </>
      )}
    </section>
  );
}
