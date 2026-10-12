import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, goBack, resetNavigation } from '@/features/test-navigation';
import { ANONYMOUS, chooseOption, makeSpace, renderInApp } from '@/features/test-support';
import type { ProblemSummary } from '../types';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { ProblemList } from './problem-list';

const problem = (slug: string, overrides: Partial<ProblemSummary> = {}): ProblemSummary => ({
  id: slug,
  slug,
  title: `Problem ${slug}`,
  status: 'published',
  version_number: 1,
  time_limit_ms: 1000,
  memory_limit_kb: 262144,
  allowed_languages: ['c', 'python'],
  created_by: { username: 'edith', display_name: 'Edith', avatar_url: null },
  created_at: '2026-10-11T00:00:00Z',
  updated_at: '2026-10-11T00:00:00Z',
  published_at: '2026-10-11T00:00:00Z',
  ...overrides,
});
const page = (items: ProblemSummary[], total = items.length) => ({ items, page: 1, page_size: 20, total });

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team');
  api.list.mockResolvedValue(page([problem('sum')]));
});

describe('the problems of a Space', () => {
  it('lists published problems to a solver, with limits and languages, linking to the problem', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    const table = await screen.findByRole('table', { name: 'Problems' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByRole('link', { name: 'Problem sum' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum'
    );
    expect(within(row).getByText('C, Python 3')).toBeTruthy();
    expect(within(row).getByText('1 s')).toBeTruthy();
    expect(within(row).getByText('256.0 MB')).toBeTruthy();
    expect(api.list).toHaveBeenCalledWith(
      'team',
      expect.objectContaining({ status: 'published', page: 1, pageSize: 20 })
    );
  });

  it('gives a solver no status filter, no status column, no edit links and no "New problem"', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    await screen.findByRole('table', { name: 'Problems' });
    expect(screen.queryByRole('combobox', { name: 'Show' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('link', { name: /New problem/ })).toBeNull();
  });

  it('shows an editor the status filter, drafts that open in the editor, and a way to start a new problem', async () => {
    api.list.mockResolvedValue(page([problem('wip', { status: 'draft', published_at: null }), problem('live')]));
    renderInApp(<ProblemList />, { space: makeSpace('editor') });
    const table = await screen.findByRole('table', { name: 'Problems' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('Draft')).toBeTruthy();
    expect(within(rows[0]!).getByRole('link', { name: 'Problem wip' }).getAttribute('href')).toBe(
      '/spaces/team/problems/wip'
    );
    expect(within(rows[0]!).getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(
      '/spaces/team/problems/wip/edit'
    );
    expect(within(rows[1]!).getByText('Published')).toBeTruthy();
    expect(within(rows[1]!).getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(
      '/spaces/team/problems/live/edit'
    );
    expect(screen.getAllByRole('link', { name: /New problem/ })[0]!.getAttribute('href')).toBe(
      '/spaces/team/problems/new'
    );
    await chooseOption('Show', 'Drafts');
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith('team', expect.objectContaining({ status: 'draft', page: 1 }))
    );
    expect(currentUrl()).toBe('/spaces/team?status=draft');
  });

  it('offers no way to add problems in an archived Space', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    await screen.findByRole('table', { name: 'Problems' });
    expect(screen.queryByRole('link', { name: /New problem/ })).toBeNull();
  });

  it('searches by title or slug after a pause in typing, starting again from page 1', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    await screen.findByRole('table', { name: 'Problems' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search problems' }), 'graph');
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith('team', expect.objectContaining({ q: 'graph', page: 1 }))
    );
  });

  it('pages through many problems', async () => {
    api.list.mockResolvedValue(page([problem('a')], 45));
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    await userEvent.click(await screen.findByRole('button', { name: /Next/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('team', expect.objectContaining({ page: 2 })));
  });

  it('explains an empty Space to an editor, and to a solver, and to a visitor', async () => {
    api.list.mockResolvedValue(page([]));
    const editor = renderInApp(<ProblemList />, { space: makeSpace('editor') });
    expect(await screen.findByText('No problems yet')).toBeTruthy();
    expect(screen.getByText(/Start a draft, add tests and a reference solution/)).toBeTruthy();
    editor.unmount();
    const solver = renderInApp(<ProblemList />, { space: makeSpace('solver') });
    expect(await screen.findByText(/Problems published in this Space will appear here/)).toBeTruthy();
    solver.unmount();
    renderInApp(<ProblemList />, { space: makeSpace(null), auth: ANONYMOUS });
    expect(await screen.findByRole('link', { name: 'Log in to take part' })).toBeTruthy();
  });

  it('says nothing matches a search', async () => {
    api.list.mockResolvedValue(page([]));
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search problems' }), 'zzz');
    expect(await screen.findByText('No problems match “zzz”')).toBeTruthy();
  });
});

describe('row click', () => {
  it('opens the editor from empty space in a row, for those who may edit', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('editor') });
    const row = (await screen.findAllByRole('row'))[1]!;
    fireEvent.click(row);
    expect(currentUrl()).toBe('/spaces/team/problems/sum/edit');
  });

  it('does nothing when a link or the text itself is clicked', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('editor') });
    const row = (await screen.findAllByRole('row'))[1]!;
    fireEvent.click(within(row).getByText('C, Python 3'));
    fireEvent.click(within(row).getByText('sum'));
    fireEvent.click(within(row).getByRole('link', { name: 'Problem sum' }));
    expect(currentUrl()).toBe('/spaces/team');
  });

  it('is not clickable for solvers', async () => {
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    const row = (await screen.findAllByRole('row'))[1]!;
    expect(row.className).not.toContain('vd-row-click');
    fireEvent.click(row);
    expect(currentUrl()).toBe('/spaces/team');
  });
});

describe('filters in the URL', () => {
  it('starts from the query: status, search and page', async () => {
    resetNavigation('/spaces/team?status=archived&q=graph&page=2');
    renderInApp(<ProblemList />, { space: makeSpace('editor') });
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith('team', { q: 'graph', status: 'archived', page: 2, pageSize: 20 })
    );
    expect((screen.getByRole('searchbox', { name: 'Search problems' }) as HTMLInputElement).value).toBe('graph');
    expect(screen.getByRole('combobox', { name: 'Show' }).textContent).toBe('Archived');
  });

  it('falls back to the defaults for values that make no sense', async () => {
    resetNavigation('/spaces/team?status=bogus&page=-3');
    renderInApp(<ProblemList />, { space: makeSpace('editor') });
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith('team', { q: '', status: 'published', page: 1, pageSize: 20 })
    );
  });

  it('ignores a draft filter in the URL for a solver', async () => {
    resetNavigation('/spaces/team?status=draft');
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith('team', expect.objectContaining({ status: 'published' }))
    );
  });

  it('writes search to the URL after a pause, and Back brings the earlier page back', async () => {
    api.list.mockResolvedValue(page([problem('a')], 45));
    renderInApp(<ProblemList />, { space: makeSpace('solver') });
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search problems' }), 'graph');
    await waitFor(() => expect(currentUrl()).toBe('/spaces/team?q=graph'));
    await userEvent.click(await screen.findByRole('button', { name: /Next/ }));
    await waitFor(() => expect(currentUrl()).toBe('/spaces/team?q=graph&page=2'));
    act(() => goBack());
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith('team', expect.objectContaining({ q: 'graph', page: 1 }))
    );
  });
});
