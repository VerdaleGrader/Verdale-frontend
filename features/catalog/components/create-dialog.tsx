'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { ApiError, errorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { suggestCatalogSlug } from '../slug';
import { PRIVACY_OPTIONS, type TrackPrivacy } from '../types';

export interface NewItem {
  name: string;
  slug: string;
  description: string;
  privacy: TrackPrivacy;
}

/**
 * The small form that creates a Track or a Collection: name, slug (suggested from the name) and description,
 * and for a Track who can see it. Core's refusals (taken or reserved slug, too long) appear next to the field.
 */
export function CreateDialog({
  kind,
  open,
  onClose,
  onCreate,
}: {
  kind: 'Track' | 'Collection';
  open: boolean;
  onClose: () => void;
  /** Creates the item; throw an ApiError to show it in the form. */
  onCreate: (item: NewItem) => Promise<void>;
}) {
  // Mounted only while open, so every opening starts with an empty form.
  return open ? <CreateForm kind={kind} onClose={onClose} onCreate={onCreate} /> : null;
}

function CreateForm({
  kind,
  onClose,
  onCreate,
}: {
  kind: 'Track' | 'Collection';
  onClose: () => void;
  onCreate: (item: NewItem) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<TrackPrivacy>('space');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), slug, description, privacy });
      toast({ tone: 'success', title: `Created ${name.trim()}` });
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) setError(caught);
      else toast({ tone: 'danger', title: `Could not create the ${kind}`, description: errorMessage(caught) });
      setSaving(false);
    }
  }

  // A 409 names no field; it is about the slug.
  const slugError = error?.fieldError('slug') ?? (error?.status === 409 ? error.message : undefined);
  const formId = `create-${kind.toLowerCase()}`;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`New ${kind}`}
      description={
        kind === 'Track'
          ? 'A Track is an ordered path of Collections. People work through it and see their progress.'
          : 'A Collection is an ordered set of problems. Put it in one or more Tracks to show it to solvers.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={saving}>
            {saving ? 'Creating…' : `Create ${kind}`}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          required
          autoFocus
          error={error?.fieldError('name')}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(suggestCatalogSlug(event.target.value));
          }}
        />
        <TextField
          label="Slug"
          mono
          value={slug}
          maxLength={64}
          hint="Part of the address: 2 to 64 lower-case letters, digits, “-” or “_”. It cannot be changed later."
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
          hint="Optional."
          error={error?.fieldError('description')}
          onChange={(event) => setDescription(event.target.value)}
        />
        {kind === 'Track' && (
          <Dropdown
            label="Who can see it"
            value={privacy}
            options={PRIVACY_OPTIONS}
            onValueChange={(next) => setPrivacy(next as TrackPrivacy)}
          />
        )}
      </form>
    </Dialog>
  );
}
