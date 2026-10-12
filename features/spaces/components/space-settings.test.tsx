import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseOption, makeSpace, renderInApp, USER } from '@/features/test-support';
import type { Role } from '../types';
import { SpaceSettings } from './space-settings';

const api = vi.hoisted(() => ({
  update: vi.fn(),
  archive: vi.fn(),
  members: vi.fn(),
  transferOwnership: vi.fn(),
}));
vi.mock('../api/spaces.api', () => ({ spacesApi: api }));
const catalog = vi.hoisted(() => ({ tracks: vi.fn() }));
vi.mock('@/features/catalog/api/catalog.api', () => ({ catalogApi: catalog }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const member = (username: string, role: Role) => ({
  username,
  display_name: username === 'sol' ? 'Sol' : `${username} Doe`,
  avatar_url: null,
  role,
  joined_at: '2026-10-11T00:00:00Z',
});

function renderSettings(role: Role, overrides = {}) {
  api.members.mockResolvedValue([member('sol', role), member('grace', 'solver'), member('ada', 'owner')]);
  return renderInApp(<SpaceSettings />, { space: makeSpace(role, { visibility: 'private', ...overrides }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  catalog.tracks.mockResolvedValue([{ id: 't1', name: 'Warm-up', slug: 'warm-up', archived: false }]);
});

describe('SpaceSettings', () => {
  it('gives the owner the details form and the danger zone', () => {
    renderSettings('owner');
    expect(screen.getByRole('textbox', { name: 'Name' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Who can see this Space' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive Space' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hand over ownership' })).toBeTruthy();
  });

  it('links to the progression of every Track for the staff who manage settings', async () => {
    renderSettings('administrator');
    expect((await screen.findByRole('link', { name: 'Warm-up' })).getAttribute('href')).toBe(
      '/spaces/team/tracks/warm-up/progress'
    );
    expect(catalog.tracks).toHaveBeenCalledWith('team', true);
  });

  it('lets an administrator edit name and description but hides every danger action', async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue({});
    renderSettings('administrator');
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Who can see this Space' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive Space' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hand over ownership/ })).toBeNull();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    // The details form never sends the visibility.
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('team', { name: 'Renamed', description: '' }));
  });

  it.each(['editor', 'observer', 'solver'] as const)('is read-only for a %s', (role) => {
    renderSettings(role);
    expect(screen.getByRole('textbox', { name: 'Name' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/owner and administrators/);
  });

  it('freezes everything in an archived Space', () => {
    renderSettings('owner', { archived_at: '2026-10-11T00:00:00Z' });
    expect(screen.getByRole('textbox', { name: 'Name' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Archived Spaces cannot be changed/);
  });

  it('confirms before changing visibility, naming the effect', async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue({});
    renderSettings('owner');
    const change = screen.getByRole('button', { name: 'Change visibility' });
    expect(change.hasAttribute('disabled')).toBe(true);
    await chooseOption('Who can see this Space', /Public/);
    await user.click(change);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/visitors who are not logged in/);
    expect(api.update).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Make public' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('team', { visibility: 'public' }));
  });

  it('hands the Space over to a chosen member after a confirmation', async () => {
    const user = userEvent.setup();
    api.transferOwnership.mockResolvedValue({});
    renderSettings('owner');
    const hand = screen.getByRole('button', { name: 'Hand over ownership' });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'New owner' }).hasAttribute('disabled')).toBe(false)
    );
    expect(hand.hasAttribute('disabled')).toBe(true);
    await chooseOption('New owner', /grace Doe/);
    // The owner cannot pick themselves.
    await user.click(hand);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/you become an administrator/);
    expect(api.transferOwnership).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Hand over ownership' }));
    await waitFor(() => expect(api.transferOwnership).toHaveBeenCalledWith('team', 'grace'));
  });

  it('does not offer yourself as the new owner', async () => {
    const user = userEvent.setup();
    renderSettings('owner');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'New owner' }).hasAttribute('disabled')).toBe(false)
    );
    await user.click(screen.getByRole('combobox', { name: 'New owner' }));
    expect(screen.queryByRole('option', { name: new RegExp(`\\(${USER.username}\\)`) })).toBeNull();
    expect(screen.getByRole('option', { name: /grace Doe/ })).toBeTruthy();
  });

  it('shows Core’s refusal when handing over fails', async () => {
    const user = userEvent.setup();
    api.transferOwnership.mockRejectedValue(new Error('That user is not a member of this Space.'));
    renderSettings('owner');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'New owner' }).hasAttribute('disabled')).toBe(false)
    );
    await chooseOption('New owner', /grace Doe/);
    await user.click(screen.getByRole('button', { name: 'Hand over ownership' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hand over ownership' }));
    expect((await screen.findByText('Could not hand the Space over')).textContent).toBeTruthy();
  });
});
