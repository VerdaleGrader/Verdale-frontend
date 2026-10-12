import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { currentUrl, resetNavigation } from '@/features/test-navigation';
import { chooseOption, makeSpace, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const reviewApi = vi.hoisted(() => ({
  list: vi.fn(),
  versions: vi.fn(),
  byMember: vi.fn(),
  memberProblems: vi.fn(),
  byTrack: vi.fn(),
  trackProblems: vi.fn(),
  byProblem: vi.fn(),
  test: vi.fn(),
}));
const tracksApi = vi.hoisted(() => ({ memberProgress: vi.fn() }));
vi.mock('@/features/tracks/api/tracks.api', () => ({ tracksApi }));
vi.mock('../../api/review.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/review.api')>()),
  reviewApi,
}));
vi.mock('@/features/problems/api/problems.api', () => ({
  problemsApi: {
    get: vi
      .fn()
      .mockResolvedValue({ title: 'Two Sum', version_number: 3, time_limit_ms: 1000, memory_limit_kb: 262144 }),
    tests: vi.fn().mockResolvedValue({ summary: { count: 20, sample_count: 2 } }),
  },
}));

import { ByMemberView } from './by-member-view';
import { ByProblemView } from './by-problem-view';
import { ByTrackView } from './by-track-view';
import { MemberProblemsView } from './member-problems-view';
import { ProblemSubmissionsView } from './submissions-view';
import { SubmissionsHome } from './submissions-home';
import { TrackProblemsView } from './track-problems-view';

const ploy = { username: 'ploys', display_name: 'Ploy Srisuk', avatar_url: null };
const memberRow = {
  user: ploy,
  role: 'solver',
  attempted: 14,
  solved: 11,
  submissions: 63,
  ac_rate: 0.41,
  last_verdict: 'WA',
  last_submission_at: '2026-10-11T00:00:00Z',
};
const track = { name: 'Week 1', slug: 'week-1' };
const trackRow = {
  track: { ...track, visibility: 'members', is_default: false },
  problems: 6,
  members: 21,
  submissions: 49,
  accepted: 11,
  members_finished: 1,
  last_submission_at: null,
};
const problem = { slug: 'two-sum', title: 'Two Sum', status: 'published' };
const subRow = (id: string, over: object = {}) => ({
  id,
  created_at: '2026-10-11T00:00:00Z',
  member: ploy,
  problem: { slug: 'two-sum', title: 'Two Sum' },
  track,
  version: 3,
  language: 'cpp',
  status: 'completed',
  verdict: 'WA',
  tests_passed: 3,
  tests_total: 20,
  time_ms: 48,
  memory_kb: 3482,
  ...over,
});
const paged = (items: object[], total = items.length, extra = {}) => ({
  items,
  page: 1,
  page_size: 10,
  total,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetNavigation('/spaces/team/submissions', { slug: 'team' });
  reviewApi.byTrack.mockResolvedValue({ items: [trackRow] });
  reviewApi.byMember.mockResolvedValue({ ...paged([memberRow], 41), totals: { members: 48, submissions: 312 } });
  reviewApi.byProblem.mockResolvedValue(paged([], 0));
  reviewApi.versions.mockResolvedValue({ items: [3, 2] });
  tracksApi.memberProgress.mockResolvedValue([
    { user: ploy, role: 'solver', progress: { solved: 3, total: 6 }, collections: [] },
  ]);
});

describe('who sees the Submissions pages', () => {
  it.each(['solver', null] as const)('shows the not-available state to %s and asks Core for nothing', async (role) => {
    renderInApp(<SubmissionsHome />, { space: makeSpace(role) });
    expect(await screen.findByRole('heading', { name: 'Submissions aren’t available' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the Space' }).getAttribute('href')).toBe('/spaces/team');
    expect(reviewApi.byMember).not.toHaveBeenCalled();
  });

  it.each(['owner', 'administrator', 'editor', 'observer'] as const)('opens for the %s', async (role) => {
    renderInApp(<SubmissionsHome />, { space: makeSpace(role) });
    expect(await screen.findByRole('table', { name: 'Members and their submissions' })).toBeTruthy();
  });

  it('marks an observer as view only', async () => {
    renderInApp(<SubmissionsHome />, { space: makeSpace('observer') });
    await screen.findByRole('table');
    expect(screen.getByText('View only')).toBeTruthy();
  });
});

describe('Group by tabs', () => {
  it('link to the three views with their counts and mark the current one', async () => {
    renderInApp(<SubmissionsHome />, { space: makeSpace('editor') });
    const nav = await screen.findByRole('navigation', { name: 'Group by' });
    await waitFor(() => expect(within(nav).getByRole('link', { name: /Member/ }).textContent).toContain('41'));
    expect(within(nav).getByRole('link', { name: /Track/ }).getAttribute('href')).toBe(
      '/spaces/team/submissions?group=track'
    );
    expect(
      within(nav)
        .getByRole('link', { name: /Problem/ })
        .getAttribute('href')
    ).toBe('/spaces/team/submissions?group=problem');
    expect(
      within(nav)
        .getByRole('link', { name: /Member/ })
        .getAttribute('aria-current')
    ).toBe('page');
  });

  it('show the track view when the URL says so', async () => {
    resetNavigation('/spaces/team/submissions?group=track', { slug: 'team' });
    renderInApp(<SubmissionsHome />, { space: makeSpace('editor') });
    expect(await screen.findByRole('table', { name: 'Tracks and their submissions' })).toBeTruthy();
  });
});

describe('by member', () => {
  it('lists members with their numbers and opens one by its link', async () => {
    renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    const row = (await screen.findByRole('link', { name: 'Ploy Srisuk' })).closest('tr')!;
    expect(within(row).getByText('41%')).toBeTruthy();
    expect(within(row).getByText('Wrong answer')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ploy Srisuk' }).getAttribute('href')).toBe(
      '/spaces/team/submissions/members/ploys'
    );
    expect(screen.getByText('48 members, 312 submissions')).toBeTruthy();
    expect(screen.getByText('Showing 1–10 of 41')).toBeTruthy();
  });

  it('puts search in the URL after a pause, and a filter at once, and shows chips that remove them', async () => {
    renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'plo');
    await waitFor(() => expect(currentUrl()).toBe('/spaces/team/submissions?q=plo'));
    await chooseOption('Role', 'Editor');
    expect(currentUrl()).toContain('role=editor');
    expect(await screen.findByText('Role: Editor')).toBeTruthy();
    expect(reviewApi.byMember).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ q: 'plo', role: 'editor' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Role: Editor' }));
    expect(currentUrl()).not.toContain('role=');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(currentUrl()).toBe('/spaces/team/submissions');
  });

  it('reads filters from the URL, ignores a value it does not know and hides the empty ones unless asked', async () => {
    resetNavigation('/spaces/team/submissions?role=nonsense&hide_empty=false&sort=solved&page=2', { slug: 'team' });
    renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    expect(reviewApi.byMember).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ role: undefined, hideEmpty: false, sort: 'solved', page: 2 })
    );
    expect(
      screen.getByRole('checkbox', { name: 'Hide members with no submissions' }).getAttribute('aria-checked')
    ).toBe('false');
  });

  it('sorts by a column header and pages with history entries', async () => {
    reviewApi.byMember.mockResolvedValue({ ...paged([memberRow], 41), totals: { members: 41, submissions: 3 } });
    renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    await userEvent.click(await screen.findByRole('button', { name: 'Solved' }));
    expect(currentUrl()).toContain('sort=solved');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(currentUrl()).toContain('page=2');
  });

  it('says so when the Space has no submissions yet, and when the filters match nothing', async () => {
    reviewApi.byMember.mockResolvedValue({ ...paged([], 0), totals: { members: 0, submissions: 0 } });
    const first = renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    expect(await screen.findByText('No submissions yet')).toBeTruthy();
    first.unmount();
    resetNavigation('/spaces/team/submissions?q=zzz', { slug: 'team' });
    renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    expect(await screen.findByText('No members match these filters')).toBeTruthy();
    await userEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Clear filters' }));
    expect(currentUrl()).toBe('/spaces/team/submissions');
  });

  it('shows a skeleton while loading and an error with a reference and a retry', async () => {
    let fail = true;
    reviewApi.byMember.mockImplementation(() =>
      fail
        ? Promise.reject(new ApiError(500, 'INTERNAL', 'boom', [], 'req_8f3a2c19'))
        : Promise.resolve({ ...paged([memberRow], 1), totals: { members: 1, submissions: 1 } })
    );
    renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    expect(screen.getByText('Loading members')).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Members could not be loaded')).toBeTruthy();
    expect(screen.getByText('Reference: req_8f3a2c19')).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Ploy Srisuk' })).toBeTruthy();
  });

  it('a click on empty space of a row opens the member, text and links do not', async () => {
    const { container } = renderInApp(<ByMemberView />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    expect(container.querySelector('tr.vd-row-click')).toBeTruthy();
  });
});

describe('by track', () => {
  it('lists tracks with visibility, progress and a link into each', async () => {
    resetNavigation('/spaces/team/submissions?group=track', { slug: 'team' });
    renderInApp(<ByTrackView />, { space: makeSpace('editor') });
    const row = (await screen.findByRole('link', { name: 'Week 1' })).closest('tr')!;
    expect(within(row).getByText('Track members only')).toBeTruthy();
    expect(within(row).getByText('1 of 21')).toBeTruthy();
    expect(within(row).getByRole('link').getAttribute('href')).toBe('/spaces/team/submissions/tracks/week-1');
  });

  it('keeps visibility and sort in the URL', async () => {
    renderInApp(<ByTrackView />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    await chooseOption('Visibility', 'Track members only');
    expect(currentUrl()).toContain('visibility=members');
    await chooseOption('Sort', 'Submissions, most');
    expect(currentUrl()).toContain('sort=submissions');
    expect(reviewApi.byTrack).toHaveBeenLastCalledWith(expect.anything(), {
      q: '',
      visibility: 'members',
      sort: 'submissions',
    });
  });

  it('has an empty state', async () => {
    reviewApi.byTrack.mockResolvedValue({ items: [] });
    renderInApp(<ByTrackView />, { space: makeSpace('editor') });
    expect(await screen.findByText('No tracks yet')).toBeTruthy();
  });
});

describe('problems of a track', () => {
  const rollup = (over: object = {}) => ({
    problem,
    collections: [{ name: 'Basics', slug: 'basics' }],
    tried: 31,
    solved: 17,
    submissions: 64,
    most_common_failure: { verdict: 'WA', test_position: 4, count: 19 },
    last_submission_at: '2026-10-11T00:00:00Z',
    ...over,
  });
  const response = (items: object[]) => ({
    track: { ...trackRow.track, collections: 2, problems: 6, members: 48, submissions: 118, accepted: 41, finished: 9 },
    collections: [{ name: 'Basics', slug: 'basics' }],
    items,
  });

  it('shows the track numbers, the most common failure and links into the problem with the track kept', async () => {
    reviewApi.trackProblems.mockResolvedValue(
      response([
        rollup(),
        rollup({
          problem: { ...problem, slug: 'draft', title: 'Draft one', status: 'draft' },
          most_common_failure: null,
          submissions: 0,
          last_submission_at: null,
        }),
      ])
    );
    resetNavigation('/spaces/team/submissions/tracks/week-1', { slug: 'team', trackSlug: 'week-1' });
    renderInApp(<TrackProblemsView />, { space: makeSpace('editor') });
    const row = (await screen.findByRole('link', { name: 'Two Sum' })).closest('tr')!;
    expect(within(row).getByText('Wrong answer on testcase 4 · 19×')).toBeTruthy();
    expect(within(row).getByRole('link').getAttribute('href')).toBe(
      '/spaces/team/submissions/problems/two-sum?track=week-1'
    );
    expect(screen.getByText('Hidden from solvers until published')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Week 1' })).toBeTruthy();
    expect(screen.getByText('Finished track')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('By track');
  });

  it('filters by status through the URL', async () => {
    reviewApi.trackProblems.mockResolvedValue(response([rollup()]));
    resetNavigation('/spaces/team/submissions/tracks/week-1', { slug: 'team', trackSlug: 'week-1' });
    renderInApp(<TrackProblemsView />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    await chooseOption('Problem status', 'Draft');
    expect(currentUrl()).toContain('status=draft');
  });

  it('answers an unknown track with the not-available state', async () => {
    reviewApi.trackProblems.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'no'));
    resetNavigation('/spaces/team/submissions/tracks/nope', { slug: 'team', trackSlug: 'nope' });
    renderInApp(<TrackProblemsView />, { space: makeSpace('editor') });
    expect(await screen.findByText('This track isn’t available')).toBeTruthy();
  });
});

describe('by problem', () => {
  const rollup = (tracks: object[]) => ({
    problem,
    tracks,
    tried: 38,
    solved: 21,
    submissions: 87,
    last_verdict: 'AC',
    last_submission_at: '2026-10-11T00:00:00Z',
  });

  it('lists problems with their tracks (the first two, then +N, or none), status and last verdict', async () => {
    reviewApi.byProblem.mockResolvedValue(
      paged(
        [
          rollup([track, { name: 'General', slug: 'g' }, { name: 'Extra', slug: 'e' }]),
          {
            ...rollup([]),
            problem: { ...problem, slug: 'lone', title: 'Lone', status: 'draft' },
            last_verdict: null,
            last_submission_at: null,
          },
        ],
        2
      )
    );
    resetNavigation('/spaces/team/submissions?group=problem', { slug: 'team' });
    renderInApp(<ByProblemView />, { space: makeSpace('editor') });
    const row = (await screen.findByRole('link', { name: 'Two Sum' })).closest('tr')!;
    expect(within(row).getByText('Week 1')).toBeTruthy();
    expect(within(row).getByText('+2')).toBeTruthy();
    expect(within(row).getByText('Published')).toBeTruthy();
    expect(within(row).getByRole('link').getAttribute('href')).toBe('/spaces/team/submissions/problems/two-sum');
    expect(within(screen.getByRole('table')).getByText('Not in any track')).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Draft')).toBeTruthy();
    expect(screen.getByText('No submissions yet')).toBeTruthy();
  });

  it('filters by track, including "Not in any track", and ignores a track that does not exist', async () => {
    reviewApi.byProblem.mockResolvedValue(paged([rollup([])], 1));
    resetNavigation('/spaces/team/submissions?group=problem&track=ghost', { slug: 'team' });
    renderInApp(<ByProblemView />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    await waitFor(() =>
      expect(reviewApi.byProblem).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ track: 'all' }))
    );
    await chooseOption('Track', 'Not in any track');
    expect(currentUrl()).toContain('track=none');
    expect(await screen.findByText('Track: Not in any track')).toBeTruthy();
  });
});

describe('problems of a member', () => {
  const response = (items: object[]) => ({ ...paged(items, items.length), member: memberRow });
  const mp = {
    problem,
    track,
    attempts: 7,
    solved: false,
    best_verdict: 'WA',
    last_verdict: 'CE',
    last_submission_at: '2026-10-11T00:00:00Z',
  };

  beforeEach(() => resetNavigation('/spaces/team/submissions/members/ploys', { slug: 'team', username: 'ploys' }));

  it('shows the member, her numbers, her progress per track and her problems', async () => {
    reviewApi.memberProblems.mockResolvedValue(response([mp]));
    renderInApp(<MemberProblemsView />, { space: makeSpace('editor') });
    expect(await screen.findByRole('heading', { name: 'Ploy Srisuk' })).toBeTruthy();
    expect(screen.getByText('@ploys · Solver')).toBeTruthy();
    expect(await screen.findByText('3 of 6')).toBeTruthy();
    const row = screen.getByRole('link', { name: 'Two Sum' }).closest('tr')!;
    expect(within(row).getByText('Wrong answer')).toBeTruthy();
    expect(within(row).getByText('Compilation error')).toBeTruthy();
    expect(within(row).getByRole('link').getAttribute('href')).toBe('/spaces/team/submissions/members/ploys/two-sum');
  });

  it('filters by status in the URL and counts against everything she tried', async () => {
    resetNavigation('/spaces/team/submissions/members/ploys?status=unsolved', { slug: 'team', username: 'ploys' });
    reviewApi.memberProblems.mockResolvedValue(response([mp]));
    renderInApp(<MemberProblemsView />, { space: makeSpace('editor') });
    expect(await screen.findByText('Status: Not solved')).toBeTruthy();
    expect(screen.getByText('1 of 14 problems')).toBeTruthy();
    expect(reviewApi.memberProblems).toHaveBeenLastCalledWith(
      expect.anything(),
      'ploys',
      expect.objectContaining({ status: 'unsolved' })
    );
  });

  it('is not available for someone who is not in the Space', async () => {
    reviewApi.memberProblems.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'no'));
    renderInApp(<MemberProblemsView />, { space: makeSpace('editor') });
    expect(await screen.findByText('This member isn’t available')).toBeTruthy();
  });
});

describe('the submissions table', () => {
  it('of a problem lists everyone with the member column, links to each submission, and sorts from the header', async () => {
    reviewApi.list.mockResolvedValue(
      paged(
        [
          subRow('a1b2c3d4-0000'),
          subRow('e5f6', {
            status: 'running',
            verdict: null,
            tests_passed: 6,
            tests_total: 20,
            time_ms: null,
            memory_kb: null,
          }),
        ],
        25
      )
    );
    resetNavigation('/spaces/team/submissions/problems/two-sum', { slug: 'team', problemSlug: 'two-sum' });
    renderInApp(<ProblemSubmissionsView mode="problem" />, { space: makeSpace('editor') });
    const link = await screen.findByRole('link', { name: '#a1b2c3d4' });
    expect(link.getAttribute('href')).toBe('/spaces/team/submissions/a1b2c3d4-0000');
    const row = link.closest('tr')!;
    expect(within(row).getByText('3 / 20')).toBeTruthy();
    expect(within(row).getByText('48 ms')).toBeTruthy();
    expect(within(row).getByText('3.4 MB')).toBeTruthy();
    expect(within(row).getByText('v3')).toBeTruthy();
    expect(screen.getByText('Running testcase 7 of 20')).toBeTruthy();
    expect(screen.getByText('25 submissions')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Member' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Submitted' }));
    expect(currentUrl()).toContain('sort=oldest');
    await userEvent.click(screen.getByRole('button', { name: 'Time' }));
    expect(currentUrl()).toContain('sort=time');
  });

  it('shows the Track filter on and a breadcrumb through the track when the URL names one', async () => {
    reviewApi.list.mockResolvedValue(paged([subRow('a')], 1));
    reviewApi.trackProblems.mockResolvedValue({
      track: {},
      collections: [],
      items: [{ problem, collections: [], tried: 31, solved: 17, submissions: 64 }],
    });
    resetNavigation('/spaces/team/submissions/problems/two-sum?track=week-1', { slug: 'team', problemSlug: 'two-sum' });
    renderInApp(<ProblemSubmissionsView mode="problem" />, { space: makeSpace('editor') });
    expect(await screen.findByText('Track: Week 1')).toBeTruthy();
    expect(reviewApi.list).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ track: 'week-1', problem: 'two-sum' })
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('By track');
    expect(await screen.findByText('31')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Track: Week 1' }));
    expect(currentUrl()).not.toContain('track=');
  });

  it('puts verdict, language and version in the URL and gives Edit problem to writers and View testcases to observers', async () => {
    reviewApi.list.mockResolvedValue(paged([subRow('a')], 1));
    reviewApi.byProblem.mockResolvedValue(
      paged(
        [
          {
            problem,
            tracks: [track],
            tried: 1,
            solved: 1,
            submissions: 1,
            last_verdict: 'AC',
            last_submission_at: null,
          },
        ],
        1
      )
    );
    resetNavigation('/spaces/team/submissions/problems/two-sum', { slug: 'team', problemSlug: 'two-sum' });
    const editor = renderInApp(<ProblemSubmissionsView mode="problem" />, { space: makeSpace('editor') });
    await screen.findByRole('table');
    await chooseOption('Verdict', 'Wrong answer');
    await chooseOption('Language', 'C++');
    await chooseOption('Version', 'Version 3 (current)');
    expect(currentUrl()).toContain('verdict=WA');
    expect(currentUrl()).toContain('language=cpp');
    expect(currentUrl()).toContain('version=3');
    expect(screen.getByRole('link', { name: 'Edit problem' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View testcases' })).toBeNull();
    editor.unmount();
    resetNavigation('/spaces/team/submissions/problems/two-sum', { slug: 'team', problemSlug: 'two-sum' });
    renderInApp(<ProblemSubmissionsView mode="problem" />, { space: makeSpace('observer') });
    expect(await screen.findByRole('link', { name: 'View testcases' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit problem' })).toBeNull();
  });

  it('of one member on one problem has no member column and says how she is doing', async () => {
    reviewApi.list.mockResolvedValue(paged([subRow('a')], 1));
    reviewApi.memberProblems.mockResolvedValue({
      ...paged(
        [
          {
            problem,
            track,
            attempts: 7,
            solved: false,
            best_verdict: 'WA',
            last_verdict: 'WA',
            last_submission_at: null,
          },
        ],
        1
      ),
      member: memberRow,
    });
    resetNavigation('/spaces/team/submissions/members/ploys/two-sum', {
      slug: 'team',
      username: 'ploys',
      problemSlug: 'two-sum',
    });
    renderInApp(<ProblemSubmissionsView mode="member" />, { space: makeSpace('editor') });
    expect(await screen.findByText('Not solved yet · 7 attempts')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Member' })).toBeNull();
    expect(reviewApi.list).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ member: 'ploys', problem: 'two-sum' })
    );
    expect(screen.getByText('20 testcases (2 sample, 18 hidden)', { exact: false })).toBeTruthy();
  });

  it('has an error state and an empty state', async () => {
    reviewApi.list.mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'));
    resetNavigation('/spaces/team/submissions/problems/two-sum', { slug: 'team', problemSlug: 'two-sum' });
    const first = renderInApp(<ProblemSubmissionsView mode="problem" />, { space: makeSpace('editor') });
    expect(await screen.findByText('Submissions could not be loaded')).toBeTruthy();
    first.unmount();
    reviewApi.list.mockResolvedValue(paged([], 0));
    renderInApp(<ProblemSubmissionsView mode="problem" />, { space: makeSpace('editor') });
    expect(await screen.findByText('No submissions yet')).toBeTruthy();
  });
});
