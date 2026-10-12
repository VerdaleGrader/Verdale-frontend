import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeSpace, renderInApp } from '@/features/test-support';
import { resetNavigation } from '@/features/test-navigation';
import { makeTrackSummary } from '../test-builders';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({
  tracks: vi.fn(),
  createTrack: vi.fn(),
  reorderTracks: vi.fn(),
  updateTrack: vi.fn(),
}));
vi.mock('../api/catalog.api', () => ({ catalogApi: api }));

import { TracksManager } from './tracks-manager';

const tracks = [
  makeTrackSummary({ id: 't1', name: 'Warm-up', slug: 'warm-up' }),
  makeTrackSummary({ id: 't2', name: 'Graphs', slug: 'graphs', privacy: 'members' }),
  makeTrackSummary({ id: 't3', name: 'Old', slug: 'old', archived: true }),
];

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team/tracks/edit');
  api.tracks.mockResolvedValue(tracks);
});

describe('TracksManager', () => {
  it.each(['owner', 'administrator', 'editor'] as const)('lets %s arrange the Tracks', async (role) => {
    renderInApp(<TracksManager />, { space: makeSpace(role) });
    expect(await screen.findByRole('button', { name: 'New Track' })).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Tracks' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => within(item).getByRole('link', { name: /^(Warm-up|Graphs)$/ }).textContent)
    ).toEqual(['Warm-up', 'Graphs']);
    expect(api.tracks).toHaveBeenCalledWith('team', true);
  });

  it.each(['observer', 'solver'] as const)('shows %s nothing to manage and does not ask Core', (role) => {
    renderInApp(<TracksManager />, { space: makeSpace(role) });
    expect(screen.getByText('Only authors can manage Tracks')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Track' })).toBeNull();
    expect(api.tracks).not.toHaveBeenCalled();
  });

  it('is frozen in an archived Space', () => {
    renderInApp(<TracksManager />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    expect(screen.getByText('This Space is archived')).toBeTruthy();
    expect(api.tracks).not.toHaveBeenCalled();
  });

  it('sends the whole new order in one call when a Track is moved from its menu', async () => {
    const user = userEvent.setup();
    api.reorderTracks.mockResolvedValue([]);
    renderInApp(<TracksManager />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: /^Move Warm-up/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    await waitFor(() => expect(api.reorderTracks).toHaveBeenCalledWith('team', ['graphs', 'warm-up']));
  });

  it('rolls the order back and says so when Core refuses', async () => {
    const user = userEvent.setup();
    api.reorderTracks.mockRejectedValue(new ApiError(409, 'ORDER_OUT_OF_DATE', 'The list may have changed.'));
    renderInApp(<TracksManager />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: /^Move Warm-up/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    expect(await screen.findByText('Could not save the new order')).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Tracks' });
    expect(within(list).getAllByRole('listitem')[0]!.textContent).toMatch(/Warm-up/);
  });

  it('creates a Track with a slug suggested from the name, and shows Core’s refusal of a taken slug', async () => {
    const user = userEvent.setup();
    api.createTrack.mockRejectedValueOnce(
      new ApiError(409, 'CONFLICT', 'This slug is already used by another Track in this Space.')
    );
    api.createTrack.mockResolvedValueOnce({});
    renderInApp(<TracksManager />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: 'New Track' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Dynamic programming');
    expect((within(dialog).getByRole('textbox', { name: 'Slug' }) as HTMLInputElement).value).toBe(
      'dynamic-programming'
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create Track' }));
    expect(await within(dialog).findByText(/already used by another Track/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Create Track' }));
    await waitFor(() =>
      expect(api.createTrack).toHaveBeenLastCalledWith('team', {
        name: 'Dynamic programming',
        slug: 'dynamic-programming',
        description: '',
        privacy: 'space',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('restores an archived Track', async () => {
    const user = userEvent.setup();
    api.updateTrack.mockResolvedValue({});
    renderInApp(<TracksManager />, { space: makeSpace('owner') });
    await user.click(await screen.findByRole('button', { name: 'Restore Old' }));
    await waitFor(() => expect(api.updateTrack).toHaveBeenCalledWith('team', 'old', { archived: false }));
  });
});
