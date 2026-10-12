'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { ApiError, errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
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

type Confirming = 'visibility' | 'archive' | null;

export function SpaceSettings() {
  const { space, abilities, reload } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description);
  const [visibility, setVisibility] = useState<Visibility>(space.visibility);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Name and description: owner and administrator. Visibility, archive and handing over: the owner only.
  const readOnly = !abilities.canManageSettings;
  const dirty = name !== space.name || description !== space.description;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await spacesApi.update(space.slug, { name, description });
      toast({ tone: 'success', title: 'Settings saved' });
      reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save the settings', description: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  async function changeVisibility() {
    setSaving(true);
    try {
      await spacesApi.update(space.slug, { visibility });
      toast({ tone: 'success', title: visibility === 'private' ? 'Space is now private' : 'Space is now public' });
      reload();
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not change the visibility', description: errorMessage(caught) });
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
          {abilities.archived
            ? 'Archived Spaces cannot be changed.'
            : 'Only the owner and administrators can change these settings.'}
        </p>
      )}

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
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
        {!readOnly && (
          <div>
            <Button type="submit" variant="primary" disabled={!dirty || saving || !name.trim()}>
              {saving && confirming === null ? 'Saving…' : 'Save changes'}
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

      {abilities.canManageDanger && (
        <section aria-labelledby="danger-heading" className="border-border flex flex-col gap-6 border-t pt-6">
          <h2 id="danger-heading" className="text-h2">
            Danger zone
          </h2>
          <p className="text-small text-text-muted -mt-4">Only the owner can do these.</p>

          <div className="flex flex-col gap-3">
            <h3 className="text-h3">Visibility</h3>
            <Dropdown
              label="Who can see this Space"
              value={visibility}
              options={VISIBILITY_OPTIONS}
              onValueChange={(next) => setVisibility(next as Visibility)}
            />
            <div>
              <Button disabled={visibility === space.visibility || saving} onClick={() => setConfirming('visibility')}>
                Change visibility
              </Button>
            </div>
          </div>

          <TransferOwnership />

          <div className="flex flex-col gap-3">
            <h3 className="text-h3">Archive this Space</h3>
            <p className="text-small text-text-muted">
              Problems stay readable, but nothing can be added, changed or submitted, and members and settings are
              frozen.
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
            <Button variant="primary" onClick={changeVisibility} disabled={saving}>
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

/**
 * Hand the Space to another member: they become the owner and you become an administrator.
 * It is the only way the owner changes, because a Space always has exactly one.
 */
function TransferOwnership() {
  const { space, reload } = useSpace();
  const { auth } = useAuth();
  const toast = useToast();
  const members = useApiQuery(() => spacesApi.members(space.slug), `members-${space.slug}`);
  const [chosen, setChosen] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const me = auth.status === 'authenticated' ? auth.user.username : null;
  const candidates = members.status === 'success' ? members.data.filter((member) => member.username !== me) : [];
  const target = candidates.find((member) => member.username === chosen);

  async function transfer() {
    if (!target) return;
    setBusy(true);
    try {
      await spacesApi.transferOwnership(space.slug, target.username);
      toast({
        tone: 'success',
        title: `${target.display_name} is now the owner`,
        description: 'You are an administrator.',
      });
      setChosen('');
      reload();
      members.reload();
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not hand the Space over', description: errorMessage(caught) });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h3">Hand over ownership</h3>
      <p className="text-small text-text-muted">
        A Space has exactly one owner. The new owner takes over visibility, archiving and handing over, and you become
        an administrator. Only the new owner can undo this.
      </p>
      {members.status === 'success' && candidates.length === 0 ? (
        <p className="text-small text-text-muted">There is nobody else in this Space yet. Invite someone first.</p>
      ) : (
        <>
          <Dropdown
            label="New owner"
            placeholder="Choose a member"
            value={chosen || undefined}
            options={candidates.map((member) => ({
              value: member.username,
              label: `${member.display_name} (${member.username})`,
            }))}
            disabled={members.status !== 'success'}
            onValueChange={setChosen}
          />
          <div>
            <Button disabled={!target || busy} onClick={() => setOpen(true)}>
              Hand over ownership
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={target ? `Hand “${space.name}” over to ${target.display_name}?` : 'Hand over ownership?'}
        description="They become the owner and you become an administrator. You cannot take the Space back unless they hand it to you."
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={transfer} disabled={busy}>
              {busy ? 'Handing over…' : 'Hand over ownership'}
            </Button>
          </>
        }
      />
    </div>
  );
}
