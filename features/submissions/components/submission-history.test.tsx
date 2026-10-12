import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSpace, makeSummary, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => ({ useParams: () => ({ problemSlug: 'sum' }), useRouter: () => ({ push: vi.fn() }) }));
const submissionsApi = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../api/submissions.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/submissions.api')>()),
  submissionsApi,
}));

import { SubmissionHistory, toRow } from './submission-history';

const base = makeSummary();
const page = (items: object[], total = items.length) => ({ items, page: 1, page_size: 20, total });

beforeEach(() => {
  vi.clearAllMocks();
  submissionsApi.list.mockResolvedValue(page([]));
});

describe('submission history', () => {
  it('lists my submissions with verdict, time and memory, each linking to its result and code', async () => {
    submissionsApi.list.mockResolvedValue(
      page([
        { ...base, id: 'a', status: 'completed', verdict: 'AC', time_ms: 12, memory_kb: 2048, tests_passed: 2 },
        { ...base, id: 'b', status: 'completed', verdict: 'WA', time_ms: 40, memory_kb: 4096, tests_passed: 1 },
        { ...base, id: 'c', status: 'running' },
      ])
    );
    renderInApp(<SubmissionHistory />);
    const table = await screen.findByRole('table', { name: 'Submissions' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Accepted')).toBeTruthy();
    expect(within(rows[0]!).getByText('12 ms')).toBeTruthy();
    expect(within(rows[1]!).getByText('Wrong answer')).toBeTruthy();
    expect(within(rows[2]!).getByText('Running')).toBeTruthy();
    expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe('/spaces/team/problems/sum/submissions/a');
    expect(submissionsApi.list).toHaveBeenCalledWith(
      { slug: 'team', problemSlug: 'sum' },
      { scope: 'mine', page: 1, pageSize: 20 }
    );
  });

  it('has an empty state that points back to the problem', async () => {
    renderInApp(<SubmissionHistory />);
    expect(await screen.findByText('No submissions yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to the problem' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum'
    );
  });

  it('pages through a long history', async () => {
    submissionsApi.list.mockResolvedValue(page([{ ...base, id: 'a' }], 45));
    renderInApp(<SubmissionHistory />);
    await userEvent.click(await screen.findByRole('button', { name: /Next/ }));
    await waitFor(() =>
      expect(submissionsApi.list).toHaveBeenLastCalledWith(expect.anything(), { scope: 'mine', page: 2, pageSize: 20 })
    );
  });

  it('lets owners and editors switch to everyone’s submissions; solvers cannot', async () => {
    const solver = renderInApp(<SubmissionHistory />, { space: makeSpace('solver') });
    await screen.findByText('No submissions yet');
    expect(screen.queryByRole('combobox', { name: 'Show' })).toBeNull();
    solver.unmount();

    renderInApp(<SubmissionHistory />, { space: makeSpace('editor') });
    const select = await screen.findByRole('combobox', { name: 'Show' });
    await userEvent.selectOptions(select, 'all');
    await waitFor(() =>
      expect(submissionsApi.list).toHaveBeenLastCalledWith(expect.anything(), { scope: 'all', page: 1, pageSize: 20 })
    );
  });
});

describe('toRow', () => {
  it('names the outcome of a finished submission and leaves in-flight ones to the badge', () => {
    const now = new Date('2026-10-11T01:00:00Z');
    expect(toRow({ ...base, status: 'completed', verdict: 'CE' }, '/b', now)).toMatchObject({
      verdict: 'CE',
      detail: 'Compilation error',
      href: '/b/submissions/s1',
      when: '1 hour ago',
    });
    expect(toRow({ ...base, status: 'queued' }, '/b', now)).toMatchObject({ verdict: 'QUEUED', detail: undefined });
  });
});
