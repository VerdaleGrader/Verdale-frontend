'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { spacesApi } from '../api/spaces.api';
import { ROLE_HINTS, ROLE_LABELS, type Member, type Role } from '../types';
import { InvitePanel } from './invite-panel';
import { useSpace } from './space-shell';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({ value: role, label: ROLE_LABELS[role] }));

type Pending = { kind: 'remove'; member: Member } | { kind: 'leave' } | null;

export function MembersPanel() {
  const { space, abilities, reload: reloadSpace } = useSpace();
  const { auth } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const members = useApiQuery(() => spacesApi.members(space.slug), `members-${space.slug}`);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  if (!abilities.canViewMembers) {
    return (
      <EmptyState
        title="Members are visible to members only"
        description="Ask an owner for an invitation if you want to join this Space."
      />
    );
  }

  const me = auth.status === 'authenticated' ? auth.user.username : null;
  const owners = members.status === 'success' ? members.data.filter((member) => member.role === 'owner') : [];
  const iAmLastOwner = space.my_role === 'owner' && owners.length === 1;

  async function changeRole(member: Member, role: Role) {
    setBusy(true);
    try {
      await spacesApi.changeRole(space.slug, member.username, role);
      toast({ tone: 'success', title: `${member.username} is now ${ROLE_LABELS[role].toLowerCase()}` });
      reloadSpace();
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not change the role', description: errorMessage(error) });
    } finally {
      setBusy(false);
      members.reload();
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'remove') {
        await spacesApi.removeMember(space.slug, pending.member.username);
        toast({ tone: 'success', title: `Removed ${pending.member.username}` });
        reloadSpace();
        members.reload();
      } else {
        await spacesApi.leave(space.slug);
        toast({ tone: 'success', title: `You left ${space.name}` });
        router.push('/spaces');
      }
    } catch (error) {
      toast({
        tone: 'danger',
        title: pending.kind === 'remove' ? 'Could not remove the member' : 'Could not leave the Space',
        description: errorMessage(error),
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="members-heading" className="text-h2">
            Members
          </h2>
          {abilities.canLeave && (
            <Button
              size="sm"
              disabled={busy || iAmLastOwner}
              onClick={() => setPending({ kind: 'leave' })}
              title={iAmLastOwner ? 'Make someone else an owner before you leave.' : undefined}
            >
              Leave Space
            </Button>
          )}
        </div>
        {iAmLastOwner && abilities.canLeave && (
          <p className="text-small text-text-muted">
            You are the only owner. Make someone else an owner before you leave.
          </p>
        )}

        {members.status === 'loading' && <Loading label="Loading members" />}
        {members.status === 'error' && <ErrorState error={members.error} onRetry={members.reload} />}
        {members.status === 'success' &&
          (members.data.length === 0 ? (
            <EmptyState title="No members" />
          ) : (
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Members of {space.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Role</th>
                    {abilities.canManageMembers && (
                      <th scope="col">
                        <span className="vd-sr">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {members.data.map((member) => {
                    const isLastOwner = member.role === 'owner' && owners.length === 1;
                    return (
                      <tr key={member.username}>
                        <td>
                          <span className="vd-inline">
                            <Avatar name={member.display_name} src={member.avatar_url} size="md" />
                            <span className="flex flex-col gap-0.5 leading-tight">
                              <span className="text-body-strong">{member.display_name}</span>
                              <span className="text-mono-label text-text-muted">
                                {member.username}
                                {member.username === me && ' (you)'}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>
                          {abilities.canManageMembers ? (
                            <Select
                              aria-label={`Role of ${member.username}`}
                              size="sm"
                              className="min-w-[8rem]"
                              value={member.role}
                              options={ROLE_OPTIONS}
                              disabled={busy || isLastOwner}
                              title={isLastOwner ? 'A Space needs at least one owner.' : ROLE_HINTS[member.role]}
                              onChange={(event) => changeRole(member, event.target.value as Role)}
                            />
                          ) : (
                            <span title={ROLE_HINTS[member.role]}>{ROLE_LABELS[member.role]}</span>
                          )}
                        </td>
                        {abilities.canManageMembers && (
                          <td className="is-num">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy || isLastOwner}
                              aria-label={`Remove ${member.username}`}
                              onClick={() => setPending({ kind: 'remove', member })}
                            >
                              Remove
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        <dl className="text-small text-text-muted mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          {ROLE_OPTIONS.map((option) => (
            <div key={option.value} className="contents">
              <dt className="text-body-strong text-text">{option.label}</dt>
              <dd>{ROLE_HINTS[option.value as Role]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {abilities.canManageMembers && <InvitePanel />}

      <Dialog
        open={pending?.kind === 'remove'}
        onClose={() => setPending(null)}
        title={pending?.kind === 'remove' ? `Remove ${pending.member.username}?` : 'Remove member?'}
        description={`They lose access to ${space.name}${space.visibility === 'private' ? ' right away' : ''}. You can invite them again later.`}
        footer={
          <>
            <Button onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? 'Removing…' : 'Remove member'}
            </Button>
          </>
        }
      />
      <Dialog
        open={pending?.kind === 'leave'}
        onClose={() => setPending(null)}
        title={`Leave “${space.name}”?`}
        description="You will need a new invitation to come back to a private Space."
        footer={
          <>
            <Button onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? 'Leaving…' : 'Leave Space'}
            </Button>
          </>
        }
      />
    </div>
  );
}
