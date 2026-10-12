import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { chooseOption, makeSpace, renderInApp } from '@/features/test-support';
import { resetNavigation } from '@/features/test-navigation';
import { makeCollectionInTrack, makeCollectionSummary, makeProblemRef, makeTrackDetail } from '../test-builders';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({
  track: vi.fn(),
  collections: vi.fn(),
  updateTrack: vi.fn(),
  setTrackCollections: vi.fn(),
  createCollection: vi.fn(),
}));
vi.mock('../api/catalog.api', () => ({ catalogApi: api }));

import { TrackEditor } from './track-editor';

const detail = makeTrackDetail({
  collections: [
    makeCollectionInTrack({
      id: 'c1',
      name: 'Basics',
      slug: 'basics',
      problems: [makeProblemRef('sum'), makeProblemRef('wip', { status: 'draft' })],
    }),
    makeCollectionInTrack({ id: 'c2', name: 'Loops', slug: 'loops', problems: [makeProblemRef('count')] }),
    makeCollectionInTrack({ id: 'c3', name: 'Retired', slug: 'retired', archived: true, problems: [] }),
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team/tracks/warm-up/edit', { slug: 'team', trackSlug: 'warm-up' });
  api.track.mockResolvedValue(detail);
  api.collections.mockResolvedValue([
    makeCollectionSummary({ id: 'c1', name: 'Basics', slug: 'basics' }),
    makeCollectionSummary({ id: 'c2', name: 'Loops', slug: 'loops' }),
    makeCollectionSummary({ id: 'c4', name: 'Recursion', slug: 'recursion' }),
  ]);
});

describe('TrackEditor', () => {
  it.each(['observer', 'solver'] as const)('shows %s no editing controls', (role) => {
    renderInApp(<TrackEditor />, { space: makeSpace(role) });
    expect(screen.getByText('Only authors can manage Tracks')).toBeTruthy();
    expect(api.track).not.toHaveBeenCalled();
  });

  it('shows the details, privacy, the Collections in order with drafts noted, and archived ones apart', async () => {
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    expect(await screen.findByRole('heading', { name: 'Edit Warm-up' })).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Warm-up');
    expect(screen.getByRole('combobox', { name: 'Who can see it' }).textContent).toBe('Everyone in the Space');
    const list = screen.getByRole('list', { name: 'Collections in this Track' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toMatch(/Basics.*2 problems · has drafts/);
    expect(items[1]!.textContent).toMatch(/Loops.*1 problem/);
    expect(screen.getByRole('heading', { name: 'Archived Collections' })).toBeTruthy();
  });

  it('saves name, description and privacy', async () => {
    const user = userEvent.setup();
    api.updateTrack.mockResolvedValue({});
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save.hasAttribute('disabled')).toBe(true);
    await chooseOption('Who can see it', /^Only people added/);
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Starter');
    await user.click(save);
    await waitFor(() =>
      expect(api.updateTrack).toHaveBeenCalledWith('team', 'warm-up', {
        name: 'Starter',
        description: 'Start here.',
        privacy: 'members',
      })
    );
  });

  it('shows Core’s field errors beside the field', async () => {
    const user = userEvent.setup();
    api.updateTrack.mockRejectedValue(
      new ApiError(400, 'VALIDATION', 'Invalid', [{ field: 'name', message: 'Name is too long.' }])
    );
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Name is too long.')).toBeTruthy();
  });

  it('archives the Track only after a confirmation', async () => {
    const user = userEvent.setup();
    api.updateTrack.mockResolvedValue({});
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: 'Archive Track' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.updateTrack).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Archive Track' }));
    await waitFor(() => expect(api.updateTrack).toHaveBeenCalledWith('team', 'warm-up', { archived: true }));
  });

  it('offers to restore an archived Track', async () => {
    api.track.mockResolvedValue({ ...detail, archived: true });
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    expect(await screen.findByRole('button', { name: 'Restore Track' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archive Track' })).toBeNull();
  });

  it('reorders Collections: the whole new order goes out, archived ones left out', async () => {
    const user = userEvent.setup();
    api.setTrackCollections.mockResolvedValue({});
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: /^Move Basics/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    await waitFor(() => expect(api.setTrackCollections).toHaveBeenCalledWith('team', 'warm-up', ['loops', 'basics']));
  });

  it('removes a Collection from the Track after a confirmation, keeping the order of the rest', async () => {
    const user = userEvent.setup();
    api.setTrackCollections.mockResolvedValue({});
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: 'Remove Basics from the Track' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/Collection and its problems are kept/);
    expect(api.setTrackCollections).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Remove from Track' }));
    await waitFor(() => expect(api.setTrackCollections).toHaveBeenCalledWith('team', 'warm-up', ['loops']));
  });

  it('adds an existing Collection at the end, offering only those not already in the Track', async () => {
    const user = userEvent.setup();
    api.setTrackCollections.mockResolvedValue({});
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('combobox', { name: 'Add an existing Collection' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Recursion']);
    await user.click(screen.getByRole('option', { name: 'Recursion' }));
    await user.click(screen.getByRole('button', { name: 'Add to Track' }));
    await waitFor(() =>
      expect(api.setTrackCollections).toHaveBeenCalledWith('team', 'warm-up', ['basics', 'loops', 'recursion'])
    );
  });

  it('creates a Collection and puts it at the end of the Track', async () => {
    const user = userEvent.setup();
    api.createCollection.mockResolvedValue({ slug: 'sorting' });
    api.setTrackCollections.mockResolvedValue({});
    renderInApp(<TrackEditor />, { space: makeSpace('administrator') });
    await user.click(await screen.findByRole('button', { name: 'New Collection' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Sorting');
    // A Collection has no privacy: that belongs to the Track.
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Create Collection' }));
    await waitFor(() =>
      expect(api.createCollection).toHaveBeenCalledWith('team', { name: 'Sorting', slug: 'sorting', description: '' })
    );
    await waitFor(() =>
      expect(api.setTrackCollections).toHaveBeenCalledWith('team', 'warm-up', ['basics', 'loops', 'sorting'])
    );
  });

  it('is a clear message when the Track does not exist', async () => {
    api.track.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Track not found.'));
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    expect(await screen.findByText('Track not found')).toBeTruthy();
  });
});
