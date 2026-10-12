import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { chooseOption, makeSpace, renderInApp } from '@/features/test-support';
import { currentUrl, resetNavigation } from '@/features/test-navigation';
import { makeCollectionSummary, makeProblemRef } from '../test-builders';
import type { CollectionDetail } from '../types';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({
  collection: vi.fn(),
  allProblems: vi.fn(),
  updateCollection: vi.fn(),
  setCollectionProblems: vi.fn(),
  changeCollectionProblems: vi.fn(),
}));
vi.mock('../api/catalog.api', () => ({ catalogApi: api, MAX_PICKER_PROBLEMS: 1000 }));

import { CollectionEditor } from './collection-editor';

const problem = (slug: string, title: string, status: 'draft' | 'published' | 'archived' = 'published') => ({
  id: slug,
  slug,
  title,
  status,
});

const collection: CollectionDetail = {
  ...makeCollectionSummary({
    id: 'c1',
    name: 'Basics',
    slug: 'basics',
    tracks: [{ name: 'Warm-up', slug: 'warm-up' }],
  }),
  space: { name: 'Team', slug: 'team' },
  problems: [makeProblemRef('sum', { title: 'Sum' }), makeProblemRef('max', { title: 'Maximum' })],
  progress: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team/collections/basics/edit', { slug: 'team', collectionSlug: 'basics' });
  api.collection.mockResolvedValue(collection);
  api.allProblems.mockResolvedValue({
    items: [
      problem('sum', 'Sum'),
      problem('max', 'Maximum'),
      problem('sort', 'Sorting'),
      problem('wip', 'Work in progress', 'draft'),
    ],
    total: 4,
  });
});

const list = (name: string) => within(screen.getByRole('list', { name })).queryAllByRole('listitem');
const titles = (name: string) =>
  list(name).map((item) => within(item).getAllByRole('checkbox')[0]!.getAttribute('id') && item.textContent);

describe('CollectionEditor', () => {
  it.each(['observer', 'solver'] as const)('shows %s nothing to edit', (role) => {
    renderInApp(<CollectionEditor />, { space: makeSpace(role) });
    expect(screen.getByText('Only authors can manage Tracks')).toBeTruthy();
    expect(api.collection).not.toHaveBeenCalled();
  });

  it('shows two lists: problems not in the Collection, with drafts badged, and the ones in it in order', async () => {
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    await screen.findByRole('list', { name: 'Problems not in this Collection' });
    await waitFor(() => expect(list('Problems not in this Collection')).toHaveLength(2));
    expect(titles('Problems not in this Collection')[0]).toMatch(/Sorting/);
    expect(titles('Problems not in this Collection')[1]).toMatch(/Work in progress.*Draft/);
    expect(titles('Problems in this Collection').map((text) => /Sum|Maximum/.exec(text ?? '')?.[0])).toEqual([
      'Sum',
      'Maximum',
    ]);
    expect(screen.getByRole('link', { name: 'Warm-up' }).getAttribute('href')).toBe('/spaces/team/tracks/warm-up');
  });

  it('adds several selected problems with one call', async () => {
    const user = userEvent.setup();
    api.changeCollectionProblems.mockResolvedValue({});
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    const add = await screen.findByRole('button', { name: /^Add selected/ });
    expect(add.hasAttribute('disabled')).toBe(true);
    await waitFor(() => expect(list('Problems not in this Collection')).toHaveLength(2));
    await user.click(screen.getByRole('checkbox', { name: /Sorting/ }));
    await user.click(screen.getByRole('checkbox', { name: /Work in progress/ }));
    expect(screen.getByRole('button', { name: 'Add selected (2)' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add selected (2)' }));
    await waitFor(() =>
      expect(api.changeCollectionProblems).toHaveBeenCalledWith('team', 'basics', { add: ['sort', 'wip'] })
    );
  });

  it('removes several selected problems with one call', async () => {
    const user = userEvent.setup();
    api.changeCollectionProblems.mockResolvedValue({});
    renderInApp(<CollectionEditor />, { space: makeSpace('administrator') });
    await user.click(await screen.findByRole('checkbox', { name: /Sum/ }));
    await user.click(screen.getByRole('checkbox', { name: /Maximum/ }));
    await user.click(screen.getByRole('button', { name: 'Remove selected (2)' }));
    await waitFor(() =>
      expect(api.changeCollectionProblems).toHaveBeenCalledWith('team', 'basics', { remove: ['sum', 'max'] })
    );
  });

  it('selects everything in a list at once', async () => {
    const user = userEvent.setup();
    renderInApp(<CollectionEditor />, { space: makeSpace('owner') });
    await user.click(await screen.findByRole('checkbox', { name: 'Select all problems in this Collection' }));
    expect(screen.getByRole('button', { name: 'Remove selected (2)' })).toBeTruthy();
  });

  it('moves a problem with the menu: the whole order of the Collection goes out in one call', async () => {
    const user = userEvent.setup();
    api.setCollectionProblems.mockResolvedValue({});
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    await user.click(await screen.findByRole('button', { name: /^Move Sum/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    await waitFor(() => expect(api.setCollectionProblems).toHaveBeenCalledWith('team', 'basics', ['max', 'sum']));
  });

  it('adds a problem by moving it to the Collection from its menu', async () => {
    const user = userEvent.setup();
    api.setCollectionProblems.mockResolvedValue({});
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    await waitFor(() => expect(list('Problems not in this Collection')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: /^Move Sorting/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to Problems in this Collection' }));
    await waitFor(() =>
      expect(api.setCollectionProblems).toHaveBeenCalledWith('team', 'basics', ['sum', 'max', 'sort'])
    );
  });

  it('shows Core’s refusal and puts the list back', async () => {
    const user = userEvent.setup();
    api.changeCollectionProblems.mockRejectedValue(
      new ApiError(400, 'VALIDATION', 'No such problem in this Space: sort.')
    );
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    await waitFor(() => expect(list('Problems not in this Collection')).toHaveLength(2));
    await user.click(screen.getByRole('checkbox', { name: /Sorting/ }));
    await user.click(screen.getByRole('button', { name: 'Add selected (1)' }));
    expect(await screen.findByText('No such problem in this Space: sort.')).toBeTruthy();
    expect(list('Problems in this Collection')).toHaveLength(2);
  });

  it('keeps the search and status of the picker in the URL and asks Core for them', async () => {
    resetNavigation('/spaces/team/collections/basics/edit?q=sort', { slug: 'team', collectionSlug: 'basics' });
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    await waitFor(() => expect(api.allProblems).toHaveBeenCalledWith('team', { q: 'sort', status: 'all' }));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('sort');
    await chooseOption('Status', 'Drafts');
    await waitFor(() => expect(api.allProblems).toHaveBeenLastCalledWith('team', { q: 'sort', status: 'draft' }));
    expect(currentUrl()).toBe('/spaces/team/collections/basics/edit?q=sort&status=draft');
  });

  it('saves the details and archives only after a confirmation', async () => {
    const user = userEvent.setup();
    api.updateCollection.mockResolvedValue({});
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Fundamentals');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.updateCollection).toHaveBeenCalledWith('team', 'basics', { name: 'Fundamentals', description: '' })
    );
    await user.click(screen.getByRole('button', { name: 'Archive Collection' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.updateCollection).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole('button', { name: 'Archive Collection' }));
    await waitFor(() => expect(api.updateCollection).toHaveBeenLastCalledWith('team', 'basics', { archived: true }));
  });

  it('is a clear message when the Collection does not exist', async () => {
    api.collection.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Collection not found.'));
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    expect(await screen.findByText('Collection not found')).toBeTruthy();
  });
});
