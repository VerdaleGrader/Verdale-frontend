'use client';

import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { authApi } from '../api/auth.api';
import { useAuth } from '../hooks/auth-provider';
import { useRequireAuth } from '../hooks/use-require-auth';
import { DISPLAY_NAME_MAX_LENGTH, displayNameError } from '../profile';

/** The account page: your picture (from the sign-in provider) and the name other people see. */
export function ProfileForm() {
  useRequireAuth();
  const { auth, refresh } = useAuth();

  if (auth.status !== 'authenticated') {
    return (
      <PageContainer narrow>
        <Loading label="Loading your account" />
      </PageContainer>
    );
  }
  return <ProfileFields user={auth.user} refresh={refresh} />;
}

function ProfileFields({
  user,
  refresh,
}: {
  user: { username: string; email: string; display_name: string; avatar_url: string | null };
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(user.display_name);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmed = name.trim();
  const localError = displayNameError(name);
  const error = serverError ?? (attempted || name !== user.display_name ? localError : undefined);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (localError) return;
    if (trimmed === user.display_name) {
      setName(trimmed);
      return;
    }
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ display_name: trimmed });
      // Everything that shows the name reads it from the signed-in account, so reloading it updates the page.
      await refresh();
      setName(updated.display_name);
      setAttempted(false);
      toast({ tone: 'success', title: 'Name updated' });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setServerError(caught.fieldError('display_name') ?? caught.message);
      } else if (caught instanceof ApiError && caught.status === 429) {
        setServerError(`You are changing your name too often. ${caught.message}`);
      } else {
        toast({ tone: 'danger', title: 'Could not update your name', description: errorMessage(caught) });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer narrow>
      <PageHeader title="Your account" description="How you appear to other people in Verdale." />
      <section aria-labelledby="profile-heading" className="flex flex-col gap-4">
        <h2 id="profile-heading" className="sr-only">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <Avatar name={user.display_name} src={user.avatar_url} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span className="text-body-strong break-words">{user.display_name}</span>
            <span className="text-mono-label text-text-muted break-words">{user.username}</span>
            <span className="text-small text-text-muted break-words">{user.email}</span>
          </div>
        </div>
        <p className="text-small text-text-muted">
          Your picture comes from the account you sign in with and is refreshed every time you sign in.
        </p>
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Display name"
            value={name}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            required
            autoComplete="name"
            hint="Shown next to your picture on problems, submissions and member lists. 1 to 64 characters."
            error={error}
            onChange={(event) => {
              setName(event.target.value);
              setServerError(null);
            }}
          />
          <div>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save name'}
            </Button>
          </div>
        </form>
      </section>
    </PageContainer>
  );
}
