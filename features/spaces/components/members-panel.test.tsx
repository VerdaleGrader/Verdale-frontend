import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/features/auth/hooks/auth-provider';
import { chooseOption } from '@/features/test-support';
import { abilitiesOf } from '../abilities';
import { ROLE_DESCRIPTIONS, type Member, type Role, type Space } from '../types';
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

function renderPanel(current: Space, members: Member[], me = 'ada', invites: unknown[] = []) {
  api.members.mockResolvedValue(members);
  api.invites.mockResolvedValue(invites);
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
  it('shows the owner the management controls for everybody but themselves', async () => {
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
    expect(await screen.findByRole('combobox', { name: 'Role of grace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove grace' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Invite people' })).toBeTruthy();
    // The one owner is never changed or removed from here.
    expect(screen.queryByRole('combobox', { name: 'Role of ada' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove ada' })).toBeNull();
  });

  it.each(['editor', 'observer', 'solver'] as const)('hides every management control from a %s', async (role) => {
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

  it('the owner cannot leave: there is no Leave button, only a pointer to handing the Space over', async () => {
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
    await screen.findByRole('combobox', { name: 'Role of grace' });
    expect(screen.queryByRole('button', { name: 'Leave Space' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/spaces/team/settings');
  });

  it('an administrator leaves like any other member', async () => {
    const user = userEvent.setup();
    api.leave.mockResolvedValue(undefined);
    renderPanel(space('administrator'), [member('ada', 'owner'), member('grace', 'administrator')], 'grace');
    await user.click(await screen.findByRole('button', { name: 'Leave Space' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave Space' }));
    await waitFor(() => expect(api.leave).toHaveBeenCalledWith('team'));
  });

  describe('role picker', () => {
    it('lists every assignable role with its description; the closed field shows only the name', async () => {
      const user = userEvent.setup();
      renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
      const picker = await screen.findByRole('combobox', { name: 'Role of grace' });
      expect(picker.textContent).toBe('Solver');
      await user.click(picker);
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual([
        expect.stringMatching(/^Administrator.*Manages settings, members and invitations/),
        expect.stringMatching(/^Editor.*Creates, edits and publishes problems/),
        expect.stringMatching(/^Observer.*Sees testcases, expected output, the code of every submission/),
        expect.stringMatching(/^Solver.*Solves the problems/),
      ]);
      // Owner is never an option: the Space is handed over in Settings.
      expect(screen.queryByRole('option', { name: /^Owner/ })).toBeNull();
      expect(options.every((option) => option.getAttribute('aria-disabled') !== 'true')).toBe(true);
    });

    it('locks the roles an administrator cannot hand out, with a lock icon and no reason text', async () => {
      const user = userEvent.setup();
      renderPanel(
        space('administrator'),
        [member('ada', 'owner'), member('boole', 'administrator'), member('grace', 'solver')],
        'boole'
      );
      await user.click(await screen.findByRole('combobox', { name: 'Role of grace' }));
      const administrator = await screen.findByRole('option', { name: /^Administrator/ });
      expect(administrator.getAttribute('aria-disabled')).toBe('true');
      expect(administrator.querySelector('.lucide-lock')).toBeTruthy();
      expect(administrator.textContent).toBe(`Administrator${ROLE_DESCRIPTIONS.administrator}`);
      expect(screen.getByRole('option', { name: /^Editor/ }).getAttribute('aria-disabled')).not.toBe('true');
    });

    it('lets an administrator change editors, observers and solvers but not the owner or other administrators', async () => {
      renderPanel(
        space('administrator'),
        [
          member('ada', 'owner'),
          member('boole', 'administrator'),
          member('curie', 'administrator'),
          member('edith', 'editor'),
        ],
        'boole'
      );
      await screen.findByRole('combobox', { name: 'Role of edith' });
      expect(screen.getByRole('button', { name: 'Remove edith' })).toBeTruthy();
      for (const other of ['ada', 'curie']) {
        expect(screen.queryByRole('combobox', { name: `Role of ${other}` })).toBeNull();
        expect(screen.queryByRole('button', { name: `Remove ${other}` })).toBeNull();
      }
      expect(screen.queryByRole('button', { name: 'Remove boole' })).toBeNull();
    });

    it('lets the owner make an administrator', async () => {
      api.changeRole.mockResolvedValue(member('grace', 'administrator'));
      renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'solver')]);
      await chooseOption('Role of grace', /^Administrator/);
      await waitFor(() => expect(api.changeRole).toHaveBeenCalledWith('team', 'grace', 'administrator'));
    });
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
    api.changeRole.mockRejectedValue(new Error('Only the owner can make or change an administrator.'));
    renderPanel(space('owner'), [member('ada', 'owner'), member('grace', 'editor')]);
    await chooseOption('Role of grace', /^Administrator/);
    await waitFor(() => expect(api.changeRole).toHaveBeenCalledWith('team', 'grace', 'administrator'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Only the owner can make or change/);
  });

  it('an archived Space freezes management', async () => {
    renderPanel(space('owner', { archived_at: '2026-10-11T00:00:00Z' }), [
      member('ada', 'owner'),
      member('grace', 'solver'),
    ]);
    await screen.findAllByText('grace');
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Role of/ })).toBeNull();
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

  describe('invitations', () => {
    it('offer administrator, editor, observer and solver with descriptions, and lock what an administrator cannot invite', async () => {
      const user = userEvent.setup();
      renderPanel(space('administrator'), [member('ada', 'owner'), member('boole', 'administrator')], 'boole');
      await user.click(await screen.findByRole('combobox', { name: 'Role' }));
      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(4);
      expect(screen.getByRole('option', { name: /^Administrator/ }).getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByRole('option', { name: /^Observer/ }).textContent).toMatch(/Sees testcases/);
    });

    it('keeps Revoke from an administrator for an invitation to administrator, which only the owner may withdraw', async () => {
      const pending = (id: string, role: Role) => ({
        id,
        space: { name: 'Team', slug: 'team' },
        track: null,
        role,
        status: 'pending',
        expires_at: '2026-10-20T00:00:00Z',
        created_at: '2026-10-11T00:00:00Z',
        invited_by: { username: 'ada', display_name: 'ada', avatar_url: null },
        invited_user: { username: id, display_name: id, avatar_url: null },
      });
      renderPanel(space('administrator'), [member('ada', 'owner'), member('boole', 'administrator')], 'boole', [
        pending('lin', 'administrator'),
        pending('kim', 'editor'),
      ]);
      expect(await screen.findByRole('button', { name: 'Revoke invitation for kim' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Revoke invitation for lin' })).toBeNull();
    });

    it('lets the owner invite an observer', async () => {
      const user = userEvent.setup();
      api.createInvite.mockResolvedValue({ id: 'i1', link: '/invites/abc', role: 'observer' });
      renderPanel(space('owner'), [member('ada', 'owner')]);
      await chooseOption('Role', /^Observer/);
      await user.click(screen.getByRole('button', { name: 'Create invitation link' }));
      await waitFor(() =>
        expect(api.createInvite).toHaveBeenCalledWith('team', expect.objectContaining({ role: 'observer' }))
      );
    });
  });
});
