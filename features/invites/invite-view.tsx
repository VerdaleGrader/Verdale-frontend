'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContainer } from '@/components/layout/page';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { spacesApi } from '@/features/spaces/api/spaces.api';
import { ROLE_HINTS, ROLE_LABELS } from '@/features/spaces/types';
import { ApiError, errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

const WHY: Record<string, string> = {
  accepted: 'This invitation has already been used.',
  declined: 'This invitation was declined.',
  revoked: 'An owner withdrew this invitation.',
  expired: 'This invitation has expired.',
};

/** Page opened from an invitation link: see what it is for, then accept or decline. */
export function InviteView({ token }: { token: string }) {
  const { auth } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const invite = useApiQuery(() => spacesApi.previewInvite(token), `invite-${token}`);
  const [busy, setBusy] = useState(false);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      if (accept) {
        const joined = await spacesApi.acceptInvite(token);
        toast({
          tone: 'success',
          title: `Joined ${joined.space.name}`,
          description: `You are ${ROLE_LABELS[joined.role].toLowerCase()}.`,
        });
        router.push(`/spaces/${joined.space.slug}`);
      } else {
        await spacesApi.declineInvite(token);
        toast({ tone: 'neutral', title: 'Invitation declined' });
        router.push('/spaces');
      }
    } catch (error) {
      const gone = error instanceof ApiError && error.status === 410;
      toast({
        tone: 'danger',
        title: gone ? 'This invitation is no longer valid' : accept ? 'Could not join the Space' : 'Could not decline',
        description: gone ? 'It may have been used by someone else, revoked, or expired.' : errorMessage(error),
      });
      invite.reload();
      setBusy(false);
    }
  }

  if (invite.status === 'loading' || auth.status === 'loading') {
    return (
      <PageContainer narrow>
        <Loading label="Loading invitation" />
      </PageContainer>
    );
  }
  if (invite.status === 'error') {
    const missing = invite.error instanceof ApiError && invite.error.status === 404;
    return (
      <PageContainer narrow>
        {missing ? (
          <EmptyState
            title="Invitation not found"
            description="Check the link you were sent, or ask the owner for a new one."
          />
        ) : (
          <ErrorState error={invite.error} onRetry={invite.reload} />
        )}
      </PageContainer>
    );
  }

  const data = invite.data;
  if (data.status !== 'pending') {
    return (
      <PageContainer narrow>
        <EmptyState
          title="This invitation is no longer valid"
          description={`${WHY[data.status] ?? ''} Ask an owner of ${data.space.name} for a new one.`.trim()}
          action={
            <Link href="/explore" className={buttonVariants({ variant: 'secondary' })}>
              Explore public Spaces
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer narrow>
      <section className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-5">
        <header className="flex flex-col gap-1">
          <p className="text-small text-text-muted vd-inline">
            <Avatar name={data.invited_by.display_name} src={data.invited_by.avatar_url} size="sm" />
            {data.invited_by.display_name} invited you to join
          </p>
          <h1 className="text-h1 break-words">{data.space.name}</h1>
          <p className="text-prose">
            As <strong>{ROLE_LABELS[data.role].toLowerCase()}</strong>. {ROLE_HINTS[data.role]}
          </p>
        </header>
        {auth.status === 'authenticated' ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => respond(true)} disabled={busy}>
              {busy ? 'Joining…' : 'Accept invitation'}
            </Button>
            <Button onClick={() => respond(false)} disabled={busy}>
              Decline
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-small text-text-muted">Log in or sign up to answer this invitation.</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/invites/${token}`)}`}
              className={buttonVariants({ variant: 'primary' })}
            >
              Log in to continue
            </Link>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
