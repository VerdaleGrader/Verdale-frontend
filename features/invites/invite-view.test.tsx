import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANONYMOUS, renderInApp } from '@/features/test-support';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const api = vi.hoisted(() => ({ previewInvite: vi.fn(), acceptInvite: vi.fn(), declineInvite: vi.fn() }));
vi.mock('@/features/spaces/api/spaces.api', () => ({ spacesApi: api }));

import { InviteView } from './invite-view';

const person = { username: 'edith', display_name: 'Edith', avatar_url: null };
const invite = (track: { name: string; slug: string } | null, role = 'solver') => ({
  id: 'i1',
  space: { name: 'Team', slug: 'team' },
  track,
  role,
  status: 'pending',
  expires_at: '2026-10-20T00:00:00Z',
  created_at: '2026-10-11T00:00:00Z',
  invited_by: person,
  invited_user: null,
});

beforeEach(() => vi.clearAllMocks());

describe('InviteView', () => {
  it('describes a Space invitation by its role and what the role can do', async () => {
    api.previewInvite.mockResolvedValue(invite(null, 'observer'));
    renderInApp(<InviteView token="abc" />);
    expect((await screen.findByText(/As/)).textContent).toMatch(/observer.*Sees testcases/);
  });

  it('describes a Track invitation: the Track, and that the person joins the Space as a solver', async () => {
    api.previewInvite.mockResolvedValue(invite({ name: 'Warm-up', slug: 'warm-up' }));
    renderInApp(<InviteView token="abc" />);
    expect((await screen.findByText(/To the Track/)).textContent).toMatch(/Warm-up.*join the Space as a solver/);
  });

  it('takes the person to the Track after accepting a Track invitation', async () => {
    api.previewInvite.mockResolvedValue(invite({ name: 'Warm-up', slug: 'warm-up' }));
    api.acceptInvite.mockResolvedValue({
      space: { name: 'Team', slug: 'team' },
      track: { name: 'Warm-up', slug: 'warm-up' },
      role: 'solver',
    });
    renderInApp(<InviteView token="abc" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/spaces/team/tracks/warm-up'));
  });

  it('takes the person to the Space after accepting a Space invitation', async () => {
    api.previewInvite.mockResolvedValue(invite(null));
    api.acceptInvite.mockResolvedValue({ space: { name: 'Team', slug: 'team' }, track: null, role: 'solver' });
    renderInApp(<InviteView token="abc" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/spaces/team'));
  });

  it('asks a visitor to log in first', async () => {
    api.previewInvite.mockResolvedValue(invite({ name: 'Warm-up', slug: 'warm-up' }));
    renderInApp(<InviteView token="abc" />, { auth: ANONYMOUS });
    expect((await screen.findByRole('link', { name: 'Log in to continue' })).getAttribute('href')).toBe(
      '/login?next=%2Finvites%2Fabc'
    );
  });
});
