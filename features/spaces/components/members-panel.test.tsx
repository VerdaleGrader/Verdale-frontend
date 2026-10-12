import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/features/auth/hooks/auth-provider';
import { abilitiesOf } from '../abilities';
import type { Member, Role, Space } from '../types';
import { MembersPanel } from './members-panel';
import { SpaceContext } from './space-shell';

const api = vi.hoisted(() => ({
  members: vi.fn(),
  invites: vi.fn(),
  changeRole: vi.fn(),
  removeMember: vi.fn(),
  leave: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));
vi.mock('../api/spaces.api', () => ({ spacesApi: api }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

function space(role: Role | null, overrides: Partial<Space> = {}): Space {
  return {
    id: 's1',
    name: 'Team',
    slug: 'team',
    description: '',
    visibility: 'private',
    is_personal: false,
    archived_at: null,
    created_at: '2026-10-11T00:00:00Z',
    my_role: role,
    member_count: 2,
    ...overrides,
  };
}

const member = (username: string, role: Role): Member => ({
  username,
  display_name: username,
  avatar_url: null,
  role,
  joined_at: '2026-10-11T00:00:00Z',
});

function renderPanel(current: Space, members: Member[], me = 'ada') {
  api.members.mockResolvedValue(members);
  api.invites.mockResolvedValue([]);
  const user = {
    id: 'u',
    email: 'a@x.io',
    username: me,
    display_name: me,
    avatar_url: null,
    created_at: '2026-10-11T00:00:00Z',
  };
  return render(
    <AuthProvider initial={{ status: 'authenticated', user }}>
      <ToastProvider>
        <SpaceContext.Provider value={{ space: current, abilities: abilitiesOf(current), reload: vi.fn() }}>
          <MembersPanel />
        </SpaceContext.Provider>
      </ToastProvider>
    </AuthProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('MembersPanel', () => {
  it('shows an owner the management controls', async () => {
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
    expect(await screen.findByRole('combobox', { name: 'Role of grace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove grace' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Invite people' })).toBeTruthy();
  });

  it.each(['editor', 'solver'] as const)('hides every management control from a %s', async (role) => {
    renderPanel(space(role), [member('ada', 'owner'), member('grace', role)], 'grace');
    expect(await screen.findByText('grace (you)')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: /Role of/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Invite people' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave Space' })).toBeTruthy();
  });

  it('does not fetch or list members for someone who is not a member', async () => {
    renderPanel(space(null, { visibility: 'public' }), []);
    expect(await screen.findByText('Members are visible to members only')).toBeTruthy();
  });

  it('protects the last owner: cannot change, remove or leave, and says why', async () => {
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
    const select = await screen.findByRole('combobox', { name: 'Role of ada' });
    expect((select as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Remove ada' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Leave Space' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/only owner/)).toBeTruthy();
  });

  it('a second owner frees the first to leave', async () => {
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'owner')]);
    await screen.findByRole('combobox', { name: 'Role of ada' });
    expect((screen.getByRole('button', { name: 'Leave Space' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('removing a member asks first, naming them, then calls Core', async () => {
    const user = userEvent.setup();
    api.removeMember.mockResolvedValue(undefined);
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
    await user.click(await screen.findByRole('button', { name: 'Remove grace' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Remove grace?')).toBeTruthy();
    expect(api.removeMember).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('team', 'grace'));
  });

  it('changing a role calls Core and shows Core’s refusal when it says no', async () => {
    const user = userEvent.setup();
    api.changeRole.mockRejectedValue(new Error('A Space needs at least one owner. Make someone else an owner first.'));
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'owner')]);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Role of grace' }), 'editor');
    await waitFor(() => expect(api.changeRole).toHaveBeenCalledWith('team', 'grace', 'editor'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/at least one owner/);
  });

  it('an archived Space freezes management', async () => {
    renderPanel(space('owner', { archived_at: '2026-10-11T00:00:00Z' }), [
      member('ada', 'owner'),
      member('grace', 'solver'),
    ]);
    await screen.findAllByText('grace');
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Invite people' })).toBeNull();
  });

  it('shows the picture of a member, and the initials when there is none', async () => {
    renderPanel(space('solver'), [
      { ...member('ada', 'owner'), display_name: 'Ada Lovelace', avatar_url: 'https://example.com/ada.png' },
      { ...member('grace', 'solver'), display_name: 'Grace Hopper' },
    ]);
    expect((await screen.findByRole('img', { name: 'Ada Lovelace' })).getAttribute('src')).toBe(
      'https://example.com/ada.png'
    );
    expect(screen.getByRole('img', { name: 'Grace Hopper' }).textContent).toBe('GH');
  });
});
