'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { ApiError, errorMessage } from '@/lib/api';
import { spacesApi } from '../api/spaces.api';
import { suggestSlug } from '../slug';
import type { Visibility } from '../types';

export const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private: only members can see it' },
  { value: 'public', label: 'Public: anyone can see it' },
];

export function CreateSpaceForm() {
  useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const space = await spacesApi.create({ name, slug, description, visibility });
      toast({ tone: 'success', title: `Created ${space.name}` });
      router.push(`/spaces/${space.slug}`);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not create the Space', description: errorMessage(caught) });
      setSaving(false);
    }
  }

  // A 409 names no field; it is about the slug.
  const slugError = error?.fieldError('slug') ?? (error?.status === 409 ? error.message : undefined);

  return (
    <PageContainer narrow>
      <PageHeader
        title="Create a Space"
        description="A Space collects related problems and decides who can see and edit them."
      />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          required
          error={error?.fieldError('name')}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(suggestSlug(event.target.value));
          }}
        />
        <TextField
          label="Slug"
          mono
          value={slug}
          maxLength={32}
          required
          hint="The address of the Space: 3 to 32 lower-case letters, digits, “-” or “_”. It cannot be changed later."
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
        <Select
          label="Visibility"
          value={visibility}
          options={VISIBILITY_OPTIONS}
          onChange={(event) => setVisibility(event.target.value as Visibility)}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving || !name.trim() || !slug}>
            {saving ? 'Creating…' : 'Create Space'}
          </Button>
          <Button type="button" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
