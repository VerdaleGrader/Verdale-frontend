'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { spacesApi } from '../api/spaces.api';
import type { Visibility } from '../types';
import { VISIBILITY_OPTIONS } from './create-space-form';
import { useSpace } from './space-shell';

/** What changing visibility does, said before it happens. */
export function visibilityWarning(from: Visibility, to: Visibility, name: string): string {
  return to === 'private'
    ? `Make “${name}” private? People who are not members lose access immediately, and it disappears from search.`
    : `Make “${name}” public? Anyone, including visitors who are not logged in, can see it and its published problems, and it appears in search.`;
}

export function SpaceSettings() {
  const { space, abilities, reload } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description);
  const [visibility, setVisibility] = useState<Visibility>(space.visibility);
  const [confirming, setConfirming] = useState<'visibility' | 'archive' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const readOnly = !abilities.canManageSettings;
  const dirty = name !== space.name || description !== space.description || visibility !== space.visibility;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await spacesApi.update(space.slug, { name, description, visibility });
      toast({ tone: 'success', title: 'Settings saved' });
      reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save the settings', description: errorMessage(caught) });
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  }

  async function archive() {
    setSaving(true);
    try {
      await spacesApi.archive(space.slug);
      toast({ tone: 'success', title: `Archived ${space.name}` });
      reload();
      router.push('/spaces');
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not archive the Space', description: errorMessage(caught) });
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  }

  return (
    <div className="flex max-w-[var(--measure)] flex-col gap-8">
      {readOnly && (
        <p role="status" className="bg-surface-sunken text-small text-text-muted rounded-md p-3">
          {abilities.archived ? 'Archived Spaces cannot be changed.' : 'Only owners can change these settings.'}
        </p>
      )}

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // Visibility changes are confirmed because they take effect for everyone at once.
          if (visibility !== space.visibility) setConfirming('visibility');
          else void save();
        }}
      >
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          disabled={readOnly}
          error={error?.fieldError('name')}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Slug"
          mono
          value={space.slug}
          disabled
          hint="The address of the Space. It cannot be changed."
          readOnly
        />
        <TextField
          label="Description"
          multiline
          rows={3}
          value={description}
          maxLength={500}
          disabled={readOnly}
          error={error?.fieldError('description')}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Dropdown
          label="Visibility"
          value={visibility}
          options={VISIBILITY_OPTIONS}
          disabled={readOnly}
          onValueChange={(next) => setVisibility(next as Visibility)}
        />
        {!readOnly && (
          <div>
            <Button type="submit" variant="primary" disabled={!dirty || saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      </form>

      <section aria-labelledby="tracks-heading" className="border-border flex flex-col gap-2 border-t pt-6">
        <h2 id="tracks-heading" className="text-h3">
          Tracks and progress
        </h2>
        <p className="text-small text-text-muted">
          Solvers reach problems through Tracks. Set them up, and see how far each member has got.
        </p>
        <p className="flex flex-wrap gap-4">
          <Link href={`/spaces/${space.slug}/manage`} className="vd-link">
            Manage Tracks and Collections
          </Link>
          <Link href={`/spaces/${space.slug}/progress`} className="vd-link">
            Member progress
          </Link>
        </p>
      </section>

      {!readOnly && (
        <section aria-labelledby="archive-heading" className="border-border flex flex-col gap-3 border-t pt-6">
          <h2 id="archive-heading" className="text-h3">
            Archive this Space
          </h2>
          <p className="text-small text-text-muted">
            Problems stay readable, but nothing can be added, changed or submitted, and members and settings are frozen.
            {space.is_personal && ' A personal Space cannot be archived.'}
          </p>
          <div>
            <Button
              variant="destructive"
              disabled={space.is_personal || saving}
              onClick={() => setConfirming('archive')}
            >
              Archive Space
            </Button>
          </div>
        </section>
      )}

      <Dialog
        open={confirming === 'visibility'}
        onClose={() => setConfirming(null)}
        title={visibility === 'private' ? 'Make this Space private?' : 'Make this Space public?'}
        description={visibilityWarning(space.visibility, visibility, space.name)}
        footer={
          <>
            <Button onClick={() => setConfirming(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : visibility === 'private' ? 'Make private' : 'Make public'}
            </Button>
          </>
        }
      />
      <Dialog
        open={confirming === 'archive'}
        onClose={() => setConfirming(null)}
        title={`Archive “${space.name}”?`}
        description="Its problems stay readable but nothing can be added, changed or submitted. Members and settings are frozen."
        footer={
          <>
            <Button onClick={() => setConfirming(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archive} disabled={saving}>
              {saving ? 'Archiving…' : 'Archive Space'}
            </Button>
          </>
        }
      />
    </div>
  );
}
