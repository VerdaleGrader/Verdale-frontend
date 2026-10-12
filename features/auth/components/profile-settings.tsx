'use client';

import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { EmptyState, Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { authApi } from '../api/auth.api';
import { useAuth } from '../hooks/auth-provider';
import { useRequireAuth } from '../hooks/use-require-auth';

export const DISPLAY_NAME_MAX = 64;

/** Mistakes visible without asking Core. The same rules Core applies (GRD-68). */
export function validateDisplayName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a name.';
  if (trimmed.length > DISPLAY_NAME_MAX) return `Use at most ${DISPLAY_NAME_MAX} characters.`;
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(trimmed)) return 'Remove line breaks and other control characters.';
  return undefined;
}

/** Account settings: the picture from the sign-in provider, and the name shown to others. */
export function ProfileSettings() {
  useRequireAuth();
  const { auth, refresh } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string>();

  if (auth.status === 'loading') {
    return (
      <PageContainer narrow>
        <Loading label="Loading your profile" />
      </PageContainer>
    );
  }
  if (auth.status !== 'authenticated') {
    return (
      <PageContainer narrow>
        <EmptyState title="Log in to see your profile" />
      </PageContainer>
    );
  }

  const user = auth.user;
  const value = edit ?? user.display_name;
  const localError = validateDisplayName(value);
  const changed = value.trim() !== user.display_name;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (localError || !changed) return;
    setSaving(true);
    setServerError(undefined);
    try {
      await authApi.updateProfile({ display_name: value.trim() });
      // Everything that shows the name reads it from here, so no new login is needed.
      await refresh();
      setEdit(null);
      toast({ tone: 'success', title: 'Name updated' });
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 429)) {
        setServerError(caught.fieldError('display_name') ?? caught.message);
      } else {
        toast({
          tone: 'danger',
          title: 'Could not update your name',
          description: caught instanceof Error ? caught.message : undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer narrow>
      <PageHeader title="Profile" description="How you appear to other people in Verdale." />
      <div className="flex items-center gap-4">
        <Avatar name={user.display_name} src={user.avatar_url} size="lg" />
        <div className="flex flex-col gap-1">
          <p className="text-body-strong">{user.display_name}</p>
          <p className="text-mono-label text-text-muted">{user.username}</p>
        </div>
      </div>
      <p className="text-small text-text-muted">
        {user.avatar_url
          ? 'Your picture comes from the account you signed in with and is refreshed each time you log in.'
          : 'Your sign-in account has no picture, so your initials are shown. Uploading a picture is not available yet.'}
      </p>
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Display name"
          value={value}
          maxLength={DISPLAY_NAME_MAX + 16}
          autoComplete="name"
          error={(edit !== null ? localError : undefined) ?? serverError}
          hint={`Shown on your submissions and in member lists. Up to ${DISPLAY_NAME_MAX} characters.`}
          onChange={(event) => {
            setEdit(event.target.value);
            setServerError(undefined);
          }}
        />
        <TextField
          label="Username"
          mono
          value={user.username}
          readOnly
          hint="Your address in Verdale. It stays the same, because it is also the address of your personal Space."
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving || !changed || Boolean(localError)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" disabled={saving || edit === null} onClick={() => setEdit(null)}>
            Reset
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
