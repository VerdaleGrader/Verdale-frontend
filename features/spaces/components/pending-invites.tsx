'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { timeAgo } from '@/lib/format';
import { spacesApi } from '../api/spaces.api';
import { ROLE_LABELS } from '../types';

/** Invitations addressed to me by username. Shown only while there are any. */
export function PendingInvites({ onJoined }: { onJoined?: () => void }) {
  const invites = useApiQuery(spacesApi.myInvites, 'my-invites');
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (invites.status !== 'success' || invites.data.length === 0) return null;

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      if (accept) {
        const joined = await spacesApi.acceptMyInvite(id);
        toast({
          tone: 'success',
          title: `Joined ${joined.space.name}`,
          description: `You are ${ROLE_LABELS[joined.role].toLowerCase()}.`,
        });
        onJoined?.();
        router.refresh();
      } else {
        await spacesApi.declineMyInvite(id);
        toast({ tone: 'neutral', title: 'Invitation declined' });
      }
      invites.reload();
    } catch (error) {
      toast({
        tone: 'danger',
        title: accept ? 'Could not join the Space' : 'Could not decline',
        description: errorMessage(error),
      });
      invites.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="pending-invites"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id="pending-invites" className="text-h3">
        Invitations ({invites.data.length})
      </h2>
      <ul className="divide-border flex flex-col divide-y">
        {invites.data.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="flex min-w-0 flex-col">
              <span className="text-body-strong break-words">
                {invite.invited_by.username} invited you to {invite.track ? `${invite.track.name} in ` : ''}
                {invite.space.name}
              </span>
              <span className="text-small text-text-muted">
                {invite.track ? 'As a solver' : `As ${ROLE_LABELS[invite.role].toLowerCase()}`} ·{' '}
                {timeAgo(invite.created_at)}
              </span>
            </span>
            <span className="flex gap-2">
              <Button size="sm" disabled={busy === invite.id} onClick={() => respond(invite.id, false)}>
                Decline
              </Button>
              <Button size="sm" disabled={busy === invite.id} onClick={() => respond(invite.id, true)}>
                Accept
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
