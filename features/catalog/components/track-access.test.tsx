import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeSpace, renderInApp } from '@/features/test-support';
import { resetNavigation } from '@/features/test-navigation';
import { makeTrackDetail } from '../test-builders';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({
  track: vi.fn(),
  updateTrack: vi.fn(),
  trackMembers: vi.fn(),
  removeTrackMember: vi.fn(),
  trackInvites: vi.fn(),
  createTrackInvite: vi.fn(),
  revokeTrackInvite: vi.fn(),
}));
vi.mock('../api/catalog.api', () => ({ catalogApi: api }));

import { TrackAccess } from './track-access';

const person = (username: string) => ({ username, display_name: `${username} Doe`, avatar_url: null });
const members = [
  { ...person('ada'), space_role: 'solver', joined_at: '2026-10-11T00:00:00Z', added_by: person('edith') },
  { ...person('grace'), space_role: null, joined_at: '2026-10-11T00:00:00Z', added_by: person('edith') },
];
const invite = (id: string, invitedUser: ReturnType<typeof person> | null) => ({
  id,
  space: { name: 'Team', slug: 'team' },
  track: { name: 'Warm-up', slug: 'warm-up' },
  role: 'solver',
  status: 'pending',
  expires_at: '2026-10-20T00:00:00Z',
  created_at: '2026-10-11T00:00:00Z',
  invited_by: person('edith'),
  invited_user: invitedUser,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team/tracks/warm-up/members', { slug: 'team', trackSlug: 'warm-up' });
  api.track.mockResolvedValue(makeTrackDetail({ privacy: 'members' }));
  api.trackMembers.mockResolvedValue(members);
  api.trackInvites.mockResolvedValue([invite('i1', person('lin')), invite('i2', null)]);
});

describe('TrackAccess (writers)', () => {
  it.each(['owner', 'administrator', 'editor'] as const)('gives %s the management controls', async (role) => {
    renderInApp(<TrackAccess />, { space: makeSpace(role) });
    expect(await screen.findByRole('button', { name: 'Remove ada from the Track' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revoke invitation for lin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revoke invitation link' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create invitation link' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Only people added/ }).hasAttribute('disabled')).toBe(false);
  });

  it('lists the people added, with their picture or initials, their role in the Space and who added them', async () => {
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    const table = await screen.findByRole('table', { name: 'People added to the Track' });
    expect(within(table).getByText('Solver')).toBeTruthy();
    expect(within(table).getByText('Not a member')).toBeTruthy();
    expect(within(table).getAllByText(/by edith/)).toHaveLength(2);
    expect(within(table).getByRole('img', { name: 'ada Doe' }).textContent).toBe('AD');
  });

  it('says plainly that people invited to a Track join the Space as Solvers', async () => {
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    expect((await screen.findByText(/joins the Space as a/)).textContent).toMatch(/Solver/);
  });

  it('removes a member only after a confirmation that says they stay in the Space', async () => {
    const user = userEvent.setup();
    api.removeTrackMember.mockResolvedValue(undefined);
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: 'Remove ada from the Track' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/They stay in the Space/);
    expect(api.removeTrackMember).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Remove from Track' }));
    await waitFor(() => expect(api.removeTrackMember).toHaveBeenCalledWith('team', 'warm-up', 'ada'));
  });

  it('revokes an invitation only after a confirmation', async () => {
    const user = userEvent.setup();
    api.revokeTrackInvite.mockResolvedValue(undefined);
    renderInApp(<TrackAccess />, { space: makeSpace('owner') });
    await user.click(await screen.findByRole('button', { name: 'Revoke invitation for lin' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.revokeTrackInvite).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Revoke invitation' }));
    await waitFor(() => expect(api.revokeTrackInvite).toHaveBeenCalledWith('team', 'warm-up', 'i1'));
  });

  it('creates a link invitation with an expiry and shows the link once', async () => {
    const user = userEvent.setup();
    api.createTrackInvite.mockResolvedValue({ ...invite('i3', null), link: '/invites/abc123' });
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: 'Create invitation link' }));
    await waitFor(() =>
      expect(api.createTrackInvite).toHaveBeenCalledWith('team', 'warm-up', { username: undefined, expires_in_days: 7 })
    );
    expect((await screen.findByText(/\/invites\/abc123$/)).textContent).toContain('/invites/abc123');
  });

  it('invites a user by name and shows Core’s refusal for an unknown one', async () => {
    const user = userEvent.setup();
    api.createTrackInvite.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'No user with that username.'));
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    await user.type(await screen.findByRole('textbox', { name: 'Username (optional)' }), 'nobody');
    await user.click(screen.getByRole('button', { name: 'Invite to Track' }));
    expect(await screen.findByText('No user with that username.')).toBeTruthy();
    expect(api.createTrackInvite).toHaveBeenCalledWith('team', 'warm-up', { username: 'nobody', expires_in_days: 7 });
  });

  it('switches privacy after a confirmation that explains the effect on who can see the Track', async () => {
    const user = userEvent.setup();
    api.updateTrack.mockResolvedValue({});
    api.track.mockResolvedValue(makeTrackDetail({ privacy: 'space' }));
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('radio', { name: /Only people added/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/Solvers who were not added to it lose access right away/);
    expect(api.updateTrack).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Make members only' }));
    await waitFor(() => expect(api.updateTrack).toHaveBeenCalledWith('team', 'warm-up', { privacy: 'members' }));
  });

  it('explains opening a members-only Track to the whole Space', async () => {
    const user = userEvent.setup();
    renderInApp(<TrackAccess />, { space: makeSpace('owner', { visibility: 'public' }) });
    await user.click(await screen.findByRole('radio', { name: /Everyone in the Space/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/visitors who are not logged in/);
    expect(dialog.textContent).toMatch(/Everyone who can see the Space can open it/);
  });
});

describe('TrackAccess (read-only and denied)', () => {
  it('lets an observer look but not change anything', async () => {
    renderInApp(<TrackAccess />, { space: makeSpace('observer') });
    expect(await screen.findByRole('table', { name: 'People added to the Track' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Revoke/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create invitation link' })).toBeNull();
    expect(screen.getByRole('radio', { name: /Only people added/ }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a solver an explanation and asks Core for nothing', () => {
    renderInApp(<TrackAccess />, { space: makeSpace('solver') });
    expect(screen.getByText('Only the Space’s staff can see who has access')).toBeTruthy();
    expect(api.trackMembers).not.toHaveBeenCalled();
    expect(api.trackInvites).not.toHaveBeenCalled();
  });

  it('freezes changes in an archived Space', async () => {
    renderInApp(<TrackAccess />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    await screen.findByRole('table', { name: 'People added to the Track' });
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create invitation link' })).toBeNull();
  });

  it('shows empty states and Core’s errors with a retry', async () => {
    api.trackMembers.mockResolvedValueOnce([]);
    api.trackInvites.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'The service is temporarily unavailable.'));
    renderInApp(<TrackAccess />, { space: makeSpace('editor') });
    expect(await screen.findByText('Nobody was added to this Track')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toMatch(/temporarily unavailable/);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Invitation link')).toBeTruthy();
  });
});
