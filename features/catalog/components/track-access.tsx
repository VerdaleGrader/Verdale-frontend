'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { RadioGroup } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/toast';
import { EXPIRY, absoluteLink } from '@/features/spaces/components/invite-panel';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ROLE_LABELS, type Role } from '@/features/spaces/types';
import { ApiError, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useApiQuery, useRefreshableQuery } from '@/lib/use-api-query';
import { catalogApi } from '../api/catalog.api';
import { PRIVACY_DESCRIPTIONS, PRIVACY_OPTIONS, trackPath, type TrackMember, type TrackPrivacy } from '../types';
import type { Invite } from '@/features/spaces/types';

/**
 * Who can reach one Track: its privacy, the people added to it, and the invitations to it.
 * Owners, administrators and editors change things; observers can look. Core checks every request again.
 */
export function TrackAccess() {
  const { space, abilities } = useSpace();
  const params = useParams<{ trackSlug: string }>();
  const trackSlug = params.trackSlug;
  const staff = abilities.canAuthorProblems;
  const manage = abilities.canEditProblems;
  const base = trackPath(space.slug, trackSlug);

  if (!staff) {
    return (
      <EmptyState
        title="Only the Space’s staff can see who has access"
        description="Owners, administrators, editors and observers see the members of a Track."
        action={
          <Link href={base} className={buttonVariants({ variant: 'secondary' })}>
            Back to the Track
          </Link>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}/tracks`} className="vd-link">
          Tracks
        </Link>
        <span aria-hidden>/</span>
        <Link href={base} className="vd-link">
          {trackSlug}
        </Link>
        <span aria-hidden>/</span>
        <span>Access</span>
      </nav>
      <h2 className="text-h2">Access to the Track</h2>
      <PrivacySection trackSlug={trackSlug} manage={manage} />
      <MembersSection trackSlug={trackSlug} manage={manage} />
      <InvitesSection trackSlug={trackSlug} manage={manage} />
    </div>
  );
}

function PrivacySection({ trackSlug, manage }: { trackSlug: string; manage: boolean }) {
  const { space } = useSpace();
  const toast = useToast();
  const track = useRefreshableQuery(
    () => catalogApi.track(space.slug, trackSlug),
    `track-access-${space.slug}-${trackSlug}`
  );
  const [next, setNext] = useState<TrackPrivacy | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!next) return;
    setBusy(true);
    try {
      await catalogApi.updateTrack(space.slug, trackSlug, { privacy: next });
      toast({
        tone: 'success',
        title: next === 'members' ? 'Track is now members only' : 'Track is now open to the Space',
      });
      await track.refetch();
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not change who can see the Track', description: errorMessage(caught) });
    } finally {
      setBusy(false);
      setNext(null);
    }
  }

  return (
    <section aria-labelledby="privacy-heading" className="flex max-w-[var(--measure)] flex-col gap-3">
      <h3 id="privacy-heading" className="text-h3">
        Who can see it
      </h3>
      {track.status === 'loading' && <Loading label="Loading the Track" />}
      {track.status === 'error' && <ErrorState error={track.error} onRetry={track.reload} />}
      {track.status === 'success' && (
        <>
          <RadioGroup
            aria-labelledby="privacy-heading"
            value={track.data.privacy}
            options={PRIVACY_OPTIONS.map((option) => ({ ...option, disabled: !manage }))}
            onValueChange={(value) => {
              if (value !== track.data.privacy) setNext(value as TrackPrivacy);
            }}
          />
          {!manage && (
            <p className="text-small text-text-muted">Only owners, administrators and editors can change this.</p>
          )}
          <Dialog
            open={next !== null}
            onClose={() => setNext(null)}
            title={next === 'members' ? 'Make this Track members only?' : 'Open this Track to the Space?'}
            description={next ? `${PRIVACY_DESCRIPTIONS[next]} ${effectOf(next)}` : undefined}
            footer={
              <>
                <Button onClick={() => setNext(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void apply()} disabled={busy}>
                  {busy ? 'Saving…' : next === 'members' ? 'Make members only' : 'Open to the Space'}
                </Button>
              </>
            }
          />
        </>
      )}
    </section>
  );
}

/** What the switch does to the people who can see the Track now. */
function effectOf(next: TrackPrivacy): string {
  return next === 'members'
    ? 'Solvers who were not added to it lose access right away.'
    : 'Everyone who can see the Space can open it, and it shows in their list of Tracks.';
}

function MembersSection({ trackSlug, manage }: { trackSlug: string; manage: boolean }) {
  const { space } = useSpace();
  const toast = useToast();
  const members = useApiQuery(
    () => catalogApi.trackMembers(space.slug, trackSlug),
    `track-members-${space.slug}-${trackSlug}`
  );
  const [removing, setRemoving] = useState<TrackMember | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await catalogApi.removeTrackMember(space.slug, trackSlug, removing.username);
      toast({ tone: 'success', title: `Removed ${removing.username} from the Track` });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not remove the member', description: errorMessage(caught) });
    } finally {
      setBusy(false);
      setRemoving(null);
      members.reload();
    }
  }

  return (
    <section aria-labelledby="track-members-heading" className="flex flex-col gap-3">
      <h3 id="track-members-heading" className="text-h3">
        People added to the Track
      </h3>
      {members.status === 'loading' && <Loading label="Loading members" />}
      {members.status === 'error' && <ErrorState error={members.error} onRetry={members.reload} />}
      {members.status === 'success' &&
        (members.data.length === 0 ? (
          <EmptyState
            title="Nobody was added to this Track"
            description="People who accept an invitation to the Track appear here."
          />
        ) : (
          <div className="vd-tablewrap">
            <table className="vd-table">
              <caption className="vd-sr">People added to the Track</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role in the Space</th>
                  <th scope="col">Added</th>
                  {manage && (
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
                        <span className="flex flex-col gap-0.5 leading-tight">
                          <span className="text-body-strong">{member.display_name}</span>
                          <span className="text-mono-label text-text-muted">{member.username}</span>
                        </span>
                      </span>
                    </td>
                    <td>{member.space_role ? ROLE_LABELS[member.space_role as Role] : 'Not a member'}</td>
                    <td className="vd-muted">
                      {timeAgo(member.joined_at)} by {member.added_by.username}
                    </td>
                    {manage && (
                      <td className="is-num">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${member.username} from the Track`}
                          onClick={() => setRemoving(member)}
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
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.username} from this Track?` : 'Remove member?'}
        description="They stay in the Space and keep their submissions, but can no longer open this Track unless it is open to the whole Space. You can invite them again later."
        footer={
          <>
            <Button onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy ? 'Removing…' : 'Remove from Track'}
            </Button>
          </>
        }
      />
    </section>
  );
}

function InvitesSection({ trackSlug, manage }: { trackSlug: string; manage: boolean }) {
  const { space } = useSpace();
  const toast = useToast();
  const invites = useApiQuery(
    () => catalogApi.trackInvites(space.slug, trackSlug),
    `track-invites-${space.slug}-${trackSlug}`
  );
  const [username, setUsername] = useState('');
  const [days, setDays] = useState('7');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<{ link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const invite = await catalogApi.createTrackInvite(space.slug, trackSlug, {
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

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      await catalogApi.revokeTrackInvite(space.slug, trackSlug, revoking.id);
      toast({ tone: 'neutral', title: 'Invitation revoked' });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not revoke the invitation', description: errorMessage(caught) });
    } finally {
      setBusy(false);
      setRevoking(null);
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
    <section aria-labelledby="track-invites-heading" className="flex flex-col gap-4">
      <h3 id="track-invites-heading" className="text-h3">
        Invitations to the Track
      </h3>
      <Banner tone="info">
        Whoever accepts an invitation to a Track joins the Space as a <strong>Solver</strong> and gets this Track. The
        role of someone who is already a member does not change.
      </Banner>

      {manage && (
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
            <Dropdown label="Expires after" value={days} options={EXPIRY} onValueChange={setDays} />
          </div>
          <div>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : username.trim() ? 'Invite to Track' : 'Create invitation link'}
            </Button>
          </div>
        </form>
      )}

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
            <Button size="sm" onClick={() => void copy(created.link)}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-body-strong">Pending invitations</h4>
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
                      <Badge tone="brand">Solver</Badge>
                      created {timeAgo(invite.created_at)} · expires{' '}
                      {new Date(invite.expires_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                  {manage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRevoking(invite)}
                      aria-label={`Revoke invitation ${invite.invited_user ? `for ${invite.invited_user.username}` : 'link'}`}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </div>

      <Dialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke this invitation?"
        description={
          revoking?.invited_user
            ? `${revoking.invited_user.username} will no longer be able to accept it.`
            : 'Nobody will be able to use the link any more.'
        }
        footer={
          <>
            <Button onClick={() => setRevoking(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void revoke()} disabled={busy}>
              {busy ? 'Revoking…' : 'Revoke invitation'}
            </Button>
          </>
        }
      />
    </section>
  );
}
