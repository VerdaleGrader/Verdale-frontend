import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/hooks/auth-provider';
import { currentUrl, resetNavigation } from '@/features/test-navigation';
import { AUTHENTICATED } from '@/features/test-support';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({ listPublic: vi.fn(), listMine: vi.fn(), myInvites: vi.fn() }));
vi.mock('../api/spaces.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/spaces.api')>()),
  spacesApi: api,
}));
vi.mock('./pending-invites', () => ({ PendingInvites: () => null }));

import { ExploreView } from './explore-view';
import { MySpacesView } from './my-spaces-view';

const empty = { items: [], page: 1, page_size: 20, total: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  api.listPublic.mockResolvedValue(empty);
  api.listMine.mockResolvedValue(empty);
});

describe('Explore in the URL', () => {
  it('reads search and page from the query', async () => {
    resetNavigation('/explore?q=graph&page=3');
    render(<ExploreView />);
    await waitFor(() => expect(api.listPublic).toHaveBeenCalledWith({ q: 'graph', page: 3, pageSize: 20 }));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('graph');
  });

  it('writes the search to the URL after a pause, with replace, and drops it when cleared', async () => {
    resetNavigation('/explore');
    render(<ExploreView />);
    const box = screen.getByRole('searchbox');
    await userEvent.type(box, 'tree');
    await waitFor(() => expect(currentUrl()).toBe('/explore?q=tree'));
    await userEvent.clear(box);
    await waitFor(() => expect(currentUrl()).toBe('/explore'));
  });

  it('falls back silently when the page in the query is not a number', async () => {
    resetNavigation('/explore?page=abc');
    render(<ExploreView />);
    await waitFor(() => expect(api.listPublic).toHaveBeenCalledWith({ q: '', page: 1, pageSize: 20 }));
  });
});

describe('My Spaces in the URL', () => {
  function renderMine() {
    return render(
      <AuthProvider initial={AUTHENTICATED}>
        <MySpacesView />
      </AuthProvider>
    );
  }

  it('opens the archived tab named in the query', async () => {
    resetNavigation('/spaces?tab=archived');
    renderMine();
    await waitFor(() => expect(api.listMine).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, true));
    expect(screen.getByRole('tab', { name: 'Archived' }).getAttribute('aria-selected')).toBe('true');
  });

  it('writes the tab to the URL, and the default tab leaves it out', async () => {
    resetNavigation('/spaces');
    renderMine();
    await userEvent.click(await screen.findByRole('tab', { name: 'Archived' }));
    expect(currentUrl()).toBe('/spaces?tab=archived');
    await userEvent.click(screen.getByRole('tab', { name: 'Active' }));
    expect(currentUrl()).toBe('/spaces');
  });

  it('ignores a tab it does not know', async () => {
    resetNavigation('/spaces?tab=other');
    renderMine();
    await waitFor(() => expect(api.listMine).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, false));
  });
});
