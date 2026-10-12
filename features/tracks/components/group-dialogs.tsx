'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { suggestProblemSlug } from '@/features/problems/slug';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { tracksApi } from '../api/tracks.api';
import {
  VISIBILITY_EXPLANATIONS,
  VISIBILITY_LABELS,
  type CollectionDetail,
  type Track,
  type TrackDetail,
  type TrackVisibility,
} from '../types';

export const SLUG_HINT = 'The address inside this Space: 2 to 64 lower-case letters, digits, “-” or “_”.';

export const VISIBILITY_OPTIONS = (Object.keys(VISIBILITY_LABELS) as TrackVisibility[]).map((value) => ({
  value,
  label: VISIBILITY_LABELS[value],
}));

/** Explains who will see the Track at the chosen privacy level. Shown wherever privacy is chosen. */
export function VisibilityExplanation({ value }: { value: TrackVisibility }) {
  return <p className="text-small text-text-muted">{VISIBILITY_EXPLANATIONS[value]}</p>;
}

function useFormError() {
  const [error, setError] = useState<ApiError | null>(null);
  const slugError = error?.fieldError('slug') ?? (error?.status === 409 ? error.message : undefined);
  return { error, setError, slugError };
}

/** Create a Track: name, slug, description and who sees it. */
export function NewTrackDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (track: TrackDetail) => void;
}) {
  const { space } = useSpace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<TrackVisibility>('space');
  const [saving, setSaving] = useState(false);
  const { error, setError, slugError } = useFormError();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const track = await tracksApi.create(space.slug, { name, slug, description, visibility });
      toast({ tone: 'success', title: `Created ${track.name}` });
      setName('');
      setSlug('');
      setSlugEdited(false);
      setDescription('');
      setVisibility('space');
      onCreated(track);
    } catch (caught) {
      if (caught instanceof ApiError && [400, 409].includes(caught.status)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not create the Track', description: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Track"
      description="A Track is a path through problems that solvers can follow. It shows the Collections you put in it."
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          required
          error={error?.fieldError('name')}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(suggestProblemSlug(event.target.value));
          }}
        />
        <TextField
          label="Slug"
          mono
          value={slug}
          maxLength={64}
          required
          hint={SLUG_HINT}
          error={slugError}
          onChange={(event) => {
            setSlug(event.target.value.toLowerCase());
            setSlugEdited(true);
          }}
        />
        <TextField
          label="Description"
          multiline
          rows={3}
          value={description}
          maxLength={500}
          hint="Optional. Up to 500 characters."
          error={error?.fieldError('description')}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Dropdown
          label="Who can see it"
          value={visibility}
          options={VISIBILITY_OPTIONS}
          onValueChange={(next) => setVisibility(next as TrackVisibility)}
        />
        <VisibilityExplanation value={visibility} />
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !name.trim() || slug.length < 2}>
            {saving ? 'Creating…' : 'Create Track'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Create a Collection and choose the Tracks it starts in. */
export function NewCollectionDialog({
  open,
  tracks,
  onClose,
  onCreated,
}: {
  open: boolean;
  tracks: Track[];
  onClose: () => void;
  onCreated: (collection: CollectionDetail) => void;
}) {
  const { space } = useSpace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { error, setError, slugError } = useFormError();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const collection = await tracksApi.createCollection(space.slug, {
        name,
        slug,
        description,
        track_slugs: [...chosen],
      });
      toast({ tone: 'success', title: `Created ${collection.name}` });
      setName('');
      setSlug('');
      setSlugEdited(false);
      setDescription('');
      setChosen(new Set());
      onCreated(collection);
    } catch (caught) {
      if (caught instanceof ApiError && [400, 409].includes(caught.status)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not create the Collection', description: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Collection"
      description="A Collection is a set of problems, such as “Week 1”. Solvers only see it through a Track."
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          required
          error={error?.fieldError('name')}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(suggestProblemSlug(event.target.value));
          }}
        />
        <TextField
          label="Slug"
          mono
          value={slug}
          maxLength={64}
          required
          hint={SLUG_HINT}
          error={slugError}
          onChange={(event) => {
            setSlug(event.target.value.toLowerCase());
            setSlugEdited(true);
          }}
        />
        <TextField
          label="Description"
          multiline
          rows={3}
          value={description}
          maxLength={500}
          hint="Optional. Up to 500 characters."
          error={error?.fieldError('description')}
          onChange={(event) => setDescription(event.target.value)}
        />
        {tracks.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="vd-label">Put it in these Tracks</legend>
            {tracks.map((track) => (
              <Checkbox
                key={track.id}
                label={track.name}
                checked={chosen.has(track.slug)}
                onCheckedChange={() =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (next.has(track.slug)) next.delete(track.slug);
                    else next.add(track.slug);
                    return next;
                  })
                }
              />
            ))}
            <p className="vd-hint">A Collection in no Track is seen by owners and editors only.</p>
            {error?.fieldError('track_slugs') && (
              <p className="vd-hint vd-hint--error" role="alert">
                {error.fieldError('track_slugs')}
              </p>
            )}
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !name.trim() || slug.length < 2}>
            {saving ? 'Creating…' : 'Create Collection'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
