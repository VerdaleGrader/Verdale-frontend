'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { ApiError, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { spacesApi } from '../api/spaces.api';
import { roleOptions } from '../role-options';
import { ROLE_LABELS, type AssignableRole, type Invite } from '../types';
import { useSpace } from './space-shell';

const EXPIRY = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

function absoluteLink(path: string): string {
  return `${window.location.origin}${path}`;
}

/** Invite by username (they answer in their own list) or create a one-time link. Owners and administrators. */
export function InvitePanel() {
  const { space } = useSpace();
  const toast = useToast();
  const invites = useApiQuery(() => spacesApi.invites(space.slug), `invites-${space.slug}`);
  const [role, setRole] = useState<AssignableRole>('solver');
  const [username, setUsername] = useState('');
  const [days, setDays] = useState('7');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<{ link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const invite = await spacesApi.createInvite(space.slug, {
        role,
        username: username.trim() || undefined,
        expires_in_days: Number(days),
      });
      if (invite.link) setCreated({ link: absoluteLink(invite.link) });
      else
        toast({
          tone: 'success',
          title: `Invited ${invite.invited_user?.username}`,
          description: 'They can answer from My Spaces.',
        });
      setUsername('');
      invites.reload();
    } catch (caught) {
      if (caught instanceof ApiError && [400, 404, 409].includes(caught.status)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not create the invitation', description: errorMessage(caught) });
    } finally {
      setCreating(false);
    }
  }

  async function revoke(invite: Invite) {
    try {
      await spacesApi.revokeInvite(space.slug, invite.id);
      toast({ tone: 'neutral', title: 'Invitation revoked' });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not revoke the invitation', description: errorMessage(caught) });
    } finally {
      invites.reload();
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* The link is shown and selectable; nothing more to do. */
    }
  }

  return (
    <section aria-labelledby="invite-heading" className="flex flex-col gap-4">
      <h2 id="invite-heading" className="text-h2">
        Invite people
      </h2>
      <form onSubmit={create} className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Username (optional)"
            mono
            value={username}
            hint="Leave empty to create a link that anyone logged in can use once."
            error={error?.status === 404 || error?.status === 409 ? error.message : error?.fieldError('username')}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Dropdown
            label="Role"
            value={role}
            options={roleOptions(space.my_role, null)}
            onValueChange={(next) => setRole(next as AssignableRole)}
          />
          <Dropdown label="Expires after" value={days} options={EXPIRY} onValueChange={setDays} />
        </div>
        <div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : username.trim() ? 'Invite member' : 'Create invitation link'}
          </Button>
        </div>
      </form>

      {created && (
        <div role="status" className="bg-primary-soft flex flex-col gap-2 rounded-lg p-4">
          <p className="text-body-strong">Your invitation link</p>
          <p className="text-small text-text-muted">
            Copy it now. For safety it is shown only once; if you lose it, create another.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-code-sm bg-surface border-border min-w-0 flex-1 rounded-md border px-3 py-2 break-all">
              {created.link}
            </code>
            <Button size="sm" onClick={() => copy(created.link)}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-h3">Pending invitations</h3>
        {invites.status === 'loading' && <Loading label="Loading invitations" />}
        {invites.status === 'error' && <ErrorState error={invites.error} onRetry={invites.reload} />}
        {invites.status === 'success' &&
          (invites.data.length === 0 ? (
            <EmptyState
              title="No pending invitations"
              description="Invitations that are waiting for an answer appear here."
            />
          ) : (
            <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
              {invites.data.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-body-strong break-words">
                      {invite.invited_user ? invite.invited_user.username : 'Invitation link'}
                    </span>
                    <span className="text-small text-text-muted flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{ROLE_LABELS[invite.role]}</Badge>
                      created {timeAgo(invite.created_at)} · expires{' '}
                      {new Date(invite.expires_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revoke(invite)}
                    aria-label={`Revoke invitation ${invite.invited_user ? `for ${invite.invited_user.username}` : 'link'}`}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
