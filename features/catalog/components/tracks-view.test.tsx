import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseOption, makeSpace, renderInApp, ANONYMOUS } from '@/features/test-support';
import { currentUrl, resetNavigation } from '@/features/test-navigation';
import { makeTrackSummary } from '../test-builders';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({ tracks: vi.fn() }));
vi.mock('../api/catalog.api', () => ({ catalogApi: api }));
const problemsApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/features/problems/api/problems.api', () => ({ problemsApi }));

import { SpaceOverview } from '@/features/spaces/components/space-overview';
import { TracksView } from './tracks-view';

const tracks = [
  makeTrackSummary(),
  makeTrackSummary({
    id: 't2',
    name: 'Graphs',
    slug: 'graphs',
    description: 'Paths and trees.',
    progress: { solved: 3, total: 3 },
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team/tracks');
  api.tracks.mockResolvedValue(tracks);
  problemsApi.list.mockResolvedValue({ items: [], page: 1, page_size: 20, total: 0 });
});

describe('TracksView (solver)', () => {
  it('lists the Tracks Core returns, with Collections, problems and a progress bar each', async () => {
    renderInApp(<TracksView />, { space: makeSpace('solver') });
    const link = await screen.findByRole('link', { name: 'Warm-up' });
    expect(link.getAttribute('href')).toBe('/spaces/team/tracks/warm-up');
    expect(screen.getAllByText('2 Collections · 4 problems')).toHaveLength(2);
    const bar = screen.getByRole('progressbar', { name: 'Progress in Warm-up' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(bar.getAttribute('aria-valuetext')).toBe('1 of 4 solved');
    expect(screen.getByRole('progressbar', { name: 'Progress in Graphs' }).getAttribute('aria-valuenow')).toBe('3');
    expect(api.tracks).toHaveBeenCalledWith('team', false);
  });

  it('shows no management or staff controls', async () => {
    renderInApp(<TracksView />, { space: makeSpace('solver') });
    await screen.findByRole('link', { name: 'Warm-up' });
    expect(screen.queryByRole('link', { name: 'Manage Tracks' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Show' })).toBeNull();
    expect(screen.queryByText('Members only')).toBeNull();
  });

  it('says when the person was added to a members-only Track', async () => {
    api.tracks.mockResolvedValue([makeTrackSummary({ privacy: 'members', is_member: true })]);
    renderInApp(<TracksView />, { space: makeSpace('solver') });
    expect(await screen.findByText('You were added')).toBeTruthy();
  });

  it('is the same for a visitor, without progress, and offers to log in when there are no Tracks', async () => {
    api.tracks.mockResolvedValue([makeTrackSummary({ progress: null })]);
    const first = renderInApp(<TracksView />, { space: makeSpace(null), auth: ANONYMOUS });
    await screen.findByRole('link', { name: 'Warm-up' });
    expect(screen.queryByRole('progressbar')).toBeNull();
    first.unmount();
    api.tracks.mockResolvedValue([]);
    renderInApp(<TracksView />, { space: makeSpace(null), auth: ANONYMOUS });
    expect(await screen.findByText('No Tracks yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in to see your Tracks' }).getAttribute('href')).toBe(
      '/login?next=%2Fspaces%2Fteam%2Ftracks'
    );
  });

  it('searches by name from the URL and writes the search back to it', async () => {
    resetNavigation('/spaces/team/tracks?q=graph');
    renderInApp(<TracksView />, { space: makeSpace('solver') });
    expect(await screen.findByRole('link', { name: 'Graphs' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Warm-up' })).toBeNull();
    const box = screen.getByRole('searchbox');
    await userEvent.clear(box);
    await userEvent.type(box, 'warm');
    await waitFor(() => expect(currentUrl()).toBe('/spaces/team/tracks?q=warm'));
    expect(await screen.findByRole('link', { name: 'Warm-up' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graphs' })).toBeNull();
  });

  it('says nothing matched, and when there are no Tracks at all', async () => {
    resetNavigation('/spaces/team/tracks?q=zzz');
    const first = renderInApp(<TracksView />, { space: makeSpace('solver') });
    expect(await screen.findByText('No Tracks match “zzz”')).toBeTruthy();
    first.unmount();
    resetNavigation('/spaces/team/tracks');
    api.tracks.mockResolvedValue([]);
    renderInApp(<TracksView />, { space: makeSpace('solver') });
    expect(await screen.findByText('No Tracks yet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Manage Tracks' })).toBeNull();
  });

  it('shows Core’s error with a retry', async () => {
    api.tracks.mockRejectedValueOnce(new Error('The service is temporarily unavailable.'));
    renderInApp(<TracksView />, { space: makeSpace('solver') });
    expect((await screen.findByRole('alert')).textContent).toMatch(/temporarily unavailable/);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Warm-up' })).toBeTruthy();
  });
});

describe('TracksView (staff)', () => {
  it('gives editors the way to manage Tracks and shows privacy and archived state', async () => {
    api.tracks.mockResolvedValue([
      makeTrackSummary({ privacy: 'members' }),
      makeTrackSummary({ id: 't3', name: 'Old', slug: 'old', archived: true }),
    ]);
    renderInApp(<TracksView />, { space: makeSpace('editor') });
    await screen.findByRole('link', { name: 'Warm-up' });
    expect(screen.getByRole('link', { name: 'Manage Tracks' }).getAttribute('href')).toBe('/spaces/team/tracks/edit');
    expect(screen.getByText('Members only')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('gives observers the view but not the management link', async () => {
    renderInApp(<TracksView />, { space: makeSpace('observer') });
    await screen.findByRole('link', { name: 'Warm-up' });
    expect(screen.queryByRole('link', { name: 'Manage Tracks' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Show' })).toBeTruthy();
  });

  it('asks Core for archived Tracks only when the URL says so, and the choice goes into the URL', async () => {
    renderInApp(<TracksView />, { space: makeSpace('owner') });
    await screen.findByRole('link', { name: 'Warm-up' });
    expect(api.tracks).toHaveBeenLastCalledWith('team', false);
    await chooseOption('Show', 'Including archived');
    await waitFor(() => expect(api.tracks).toHaveBeenLastCalledWith('team', true));
    expect(currentUrl()).toBe('/spaces/team/tracks?show=all');
  });

  it('hides the management link in an archived Space', async () => {
    renderInApp(<TracksView />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    await screen.findByRole('link', { name: 'Warm-up' });
    expect(screen.queryByRole('link', { name: 'Manage Tracks' })).toBeNull();
  });
});

describe('Space overview', () => {
  it('shows a solver the Tracks and never lists the Space’s problems', async () => {
    renderInApp(<SpaceOverview />, { space: makeSpace('solver') });
    expect(await screen.findByRole('heading', { name: 'Tracks' })).toBeTruthy();
    expect(problemsApi.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Problems' })).toBeNull();
  });

  it('shows a visitor the Tracks too', async () => {
    renderInApp(<SpaceOverview />, { space: makeSpace(null), auth: ANONYMOUS });
    expect(await screen.findByRole('heading', { name: 'Tracks' })).toBeTruthy();
    expect(problemsApi.list).not.toHaveBeenCalled();
  });

  it('keeps the problem list for the staff', async () => {
    renderInApp(<SpaceOverview />, { space: makeSpace('observer') });
    expect(await screen.findByRole('heading', { name: 'Problems' })).toBeTruthy();
    expect(api.tracks).not.toHaveBeenCalled();
  });
});
