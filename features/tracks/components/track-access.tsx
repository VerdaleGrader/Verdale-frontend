'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABELS } from '@/features/spaces/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { tracksApi } from '../api/tracks.api';
import type { TrackMember } from '../types';

const EXPIRY = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

type Pending = { kind: 'member'; member: TrackMember } | { kind: 'invite'; id: string; label: string } | null;

function absoluteLink(path: string): string {
  return `${window.location.origin}${path}`;
}

/** Members of a Track and its invitations: add by link or username, set an expiry, revoke, remove (GRD-85). */
export function TrackAccess({
  trackSlug,
  trackName,
  editable,
}: {
  trackSlug: string;
  trackName: string;
  editable: boolean;
}) {
  const { space } = useSpace();
  const toast = useToast();
  const members = useApiQuery(
    () => tracksApi.members(space.slug, trackSlug),
    `track-members-${space.slug}-${trackSlug}`
  );
  const invites = useApiQuery(
    () => tracksApi.invites(space.slug, trackSlug),
    `track-invites-${space.slug}-${trackSlug}`
  );
  const [username, setUsername] = useState('');
  const [days, setDays] = useState('7');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<{ link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const invite = await tracksApi.createInvite(space.slug, trackSlug, {
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

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'member') {
        await tracksApi.removeMember(space.slug, trackSlug, pending.member.username);
        toast({ tone: 'success', title: `Removed ${pending.member.username} from ${trackName}` });
      } else {
        await tracksApi.revokeInvite(space.slug, trackSlug, pending.id);
        toast({ tone: 'neutral', title: 'Invitation revoked' });
      }
    } catch (caught) {
      toast({
        tone: 'danger',
        title: pending.kind === 'member' ? 'Could not remove the member' : 'Could not revoke the invitation',
        description: errorMessage(caught),
      });
    } finally {
      setBusy(false);
      setPending(null);
      members.reload();
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
    <div className="flex flex-col gap-8">
      <section aria-labelledby="track-members-heading" className="flex flex-col gap-3">
        <h3 id="track-members-heading" className="text-h2">
          Members of this Track
        </h3>
        <p className="text-small text-text-muted max-w-[var(--measure)]">
          Removing someone here takes them out of the Track only. They stay in the Space.
        </p>
        {members.status === 'loading' && <Loading label="Loading members" />}
        {members.status === 'error' && <ErrorState error={members.error} onRetry={members.reload} />}
        {members.status === 'success' &&
          (members.data.length === 0 ? (
            <EmptyState
              title="Nobody was added to this Track"
              description="People who accept an invitation to this Track appear here."
            />
          ) : (
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Members of {trackName}</caption>
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Role in the Space</th>
                    <th scope="col">Joined</th>
                    {editable && (
                      <th scope="col">
                        <span className="vd-sr">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {members.data.map((member) => (
                    <tr key={member.username}>
                      <td>
                        <span className="vd-inline">
                          <Avatar name={member.display_name} src={member.avatar_url} size="md" />
                          <span className="flex flex-col gap-1">
                            <span className="text-body-strong">{member.display_name}</span>
                            <span className="text-mono-label text-text-muted">{member.username}</span>
                          </span>
                        </span>
                      </td>
                      <td>{member.space_role ? ROLE_LABELS[member.space_role] : '–'}</td>
                      <td className="vd-muted">{timeAgo(member.joined_at)}</td>
                      {editable && (
                        <td className="is-num">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${member.username} from this Track`}
                            onClick={() => setPending({ kind: 'member', member })}
                          >
                            Remove
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      {editable && (
        <section aria-labelledby="track-invite-heading" className="flex flex-col gap-4">
          <h3 id="track-invite-heading" className="text-h2">
            Invite people to this Track
          </h3>
          <p className="bg-surface-sunken text-small rounded-md p-3" role="note">
            Anyone invited here joins <strong>{space.name}</strong> as a <strong>solver</strong> if they are not a
            member yet. People who are already in the Space keep their role. An invitation never makes anyone an owner
            or an editor.
          </p>
          <form
            onSubmit={create}
            className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Username (optional)"
                mono
                value={username}
                hint="Leave empty to create a link that anyone logged in can use once."
                error={error?.status === 404 || error?.status === 409 ? error.message : error?.fieldError('username')}
                onChange={(event) => setUsername(event.target.value)}
              />
              <Select
                label="Expires after"
                value={days}
                options={EXPIRY}
                onChange={(event) => setDays(event.target.value)}
              />
            </div>
            <div>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : username.trim() ? 'Invite person' : 'Create invitation link'}
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
            <h4 className="text-h3">Pending invitations</h4>
            {invites.status === 'loading' && <Loading label="Loading invitations" />}
            {invites.status === 'error' && <ErrorState error={invites.error} onRetry={invites.reload} />}
            {invites.status === 'success' &&
              (invites.data.length === 0 ? (
                <EmptyState
                  title="No pending invitations"
                  description="Links and invitations that are waiting for an answer appear here."
                />
              ) : (
                <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
                  {invites.data.map((invite) => {
                    const label = invite.invited_user ? `for ${invite.invited_user.username}` : 'link';
                    return (
                      <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-body-strong break-words">
                            {invite.invited_user ? invite.invited_user.username : 'Invitation link'}
                          </span>
                          <span className="text-small text-text-muted flex flex-wrap items-center gap-2">
                            <Badge tone="brand">{ROLE_LABELS.solver}</Badge>
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
                          aria-label={`Revoke invitation ${label}`}
                          onClick={() => setPending({ kind: 'invite', id: invite.id, label })}
                        >
                          Revoke
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>
        </section>
      )}

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending?.kind === 'member'
            ? `Remove ${pending.member.username} from ${trackName}?`
            : `Revoke the invitation ${pending?.kind === 'invite' ? pending.label : ''}?`
        }
        description={
          pending?.kind === 'member'
            ? 'They lose the Track and the problems that are only reachable through it. They stay a member of the Space, and you can invite them again.'
            : 'The link or invitation stops working at once. People who already joined stay in the Track.'
        }
        footer={
          <>
            <Button onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? 'Working…' : pending?.kind === 'member' ? 'Remove from Track' : 'Revoke invitation'}
            </Button>
          </>
        }
      />
    </div>
  );
}
