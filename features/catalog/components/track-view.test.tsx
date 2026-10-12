import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ANONYMOUS, makeSpace, renderInApp } from '@/features/test-support';
import { resetNavigation } from '@/features/test-navigation';
import { makeCollectionInTrack, makeProblemRef, makeTrackDetail } from '../test-builders';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const api = vi.hoisted(() => ({ track: vi.fn(), trackProgress: vi.fn() }));
vi.mock('../api/catalog.api', () => ({ catalogApi: api }));

import { TrackProgressView } from './track-progress-view';
import { TrackView } from './track-view';

const solved = { solved: true, last_verdict: 'AC' };
const detail = makeTrackDetail({
  progress: { solved: 1, total: 3 },
  collections: [
    makeCollectionInTrack({
      id: 'c1',
      name: 'Basics',
      slug: 'basics',
      description: 'The first steps.',
      progress: { solved: 1, total: 2 },
      problems: [
        makeProblemRef('sum', { title: 'Sum', my_result: solved }),
        makeProblemRef('max', { title: 'Maximum', my_result: { solved: false, last_verdict: 'WA' } }),
      ],
    }),
    makeCollectionInTrack({
      id: 'c2',
      name: 'Loops',
      slug: 'loops',
      progress: { solved: 0, total: 1 },
      problems: [makeProblemRef('count', { title: 'Counting' })],
    }),
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team/tracks/warm-up', { slug: 'team', trackSlug: 'warm-up' });
  api.track.mockResolvedValue(detail);
});

describe('TrackView (solver)', () => {
  it('shows Collections in Core’s order with their problems, results and progress bars', async () => {
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    expect(await screen.findByRole('heading', { name: 'Warm-up' })).toBeTruthy();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Basics', 'Loops']);
    expect(screen.getByText('The first steps.')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progress in Warm-up' }).getAttribute('aria-valuetext')).toBe(
      '1 of 3 solved'
    );
    expect(screen.getByRole('progressbar', { name: 'Progress in Basics' }).getAttribute('aria-valuetext')).toBe(
      '1 of 2 solved'
    );
    const basics = screen.getByRole('table', { name: 'Problems in Basics' });
    const rows = within(basics).getAllByRole('row');
    expect(within(rows[1]!).getByRole('link', { name: 'Sum' }).getAttribute('href')).toBe('/spaces/team/problems/sum');
    expect(within(rows[1]!).getByText('Solved')).toBeTruthy();
    expect(within(rows[2]!).getByText('Wrong answer')).toBeTruthy();
    const loops = screen.getByRole('table', { name: 'Problems in Loops' });
    expect(within(loops).getByText('Not tried')).toBeTruthy();
  });

  it('shows no staff controls and no draft status', async () => {
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    await screen.findByRole('heading', { name: 'Warm-up' });
    for (const name of ['Edit Track', 'Access', 'Progression']) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull();
    expect(screen.queryByText('Members only')).toBeNull();
  });

  it('is a clear 404 when Core does not let the person see the Track', async () => {
    api.track.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Track not found.'));
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    expect(await screen.findByText('Track not found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'All Tracks' }).getAttribute('href')).toBe('/spaces/team/tracks');
  });

  it('shows other errors with a retry', async () => {
    api.track.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'The service is temporarily unavailable.'));
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Warm-up' })).toBeTruthy();
  });

  it('says so when the Track has no Collections yet', async () => {
    api.track.mockResolvedValue(makeTrackDetail({ collections: [] }));
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    expect(await screen.findByText('This Track has no Collections yet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit Track' })).toBeNull();
  });
});

describe('TrackView (visitor)', () => {
  it('looks like the solver view without results, and asks to log in', async () => {
    api.track.mockResolvedValue(
      makeTrackDetail({
        progress: null,
        collections: [
          makeCollectionInTrack({
            progress: null,
            problems: [makeProblemRef('sum', { title: 'Sum', my_result: null })],
          }),
        ],
      })
    );
    renderInApp(<TrackView />, { space: makeSpace(null), auth: ANONYMOUS });
    expect(await screen.findByRole('link', { name: 'Sum' })).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Your result' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      '/login?next=%2Fspaces%2Fteam%2Ftracks%2Fwarm-up'
    );
  });
});

describe('TrackView (staff)', () => {
  const staffDetail = makeTrackDetail({
    privacy: 'members',
    member_count: 4,
    collections: [
      makeCollectionInTrack({
        problems: [
          makeProblemRef('sum', { title: 'Sum' }),
          makeProblemRef('hidden', { title: 'Work in progress', status: 'draft' }),
        ],
      }),
      makeCollectionInTrack({ id: 'c9', name: 'Retired', slug: 'retired', archived: true, problems: [] }),
    ],
  });

  it('shows drafts with a status badge, archived Collections and the privacy of the Track', async () => {
    api.track.mockResolvedValue(staffDetail);
    renderInApp(<TrackView />, { space: makeSpace('editor') });
    await screen.findByRole('heading', { name: 'Warm-up' });
    const table = screen.getByRole('table', { name: 'Problems in Basics' });
    expect(within(table).getByText('Draft')).toBeTruthy();
    expect(within(table).getByText('Published')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByText('Only people added to the Track')).toBeTruthy();
  });

  it.each([
    ['owner', true],
    ['administrator', true],
    ['editor', true],
    ['observer', false],
  ] as const)('%s: edit link %s, progression and access always', async (role, canEdit) => {
    api.track.mockResolvedValue(staffDetail);
    renderInApp(<TrackView />, { space: makeSpace(role) });
    await screen.findByRole('heading', { name: 'Warm-up' });
    expect(screen.getByRole('link', { name: 'Progression' }).getAttribute('href')).toBe(
      '/spaces/team/tracks/warm-up/progress'
    );
    expect(screen.getByRole('link', { name: 'Access' }).getAttribute('href')).toBe(
      '/spaces/team/tracks/warm-up/members'
    );
    expect(!!screen.queryByRole('link', { name: 'Edit Track' })).toBe(canEdit);
  });

  it('hides editing in an archived Space', async () => {
    api.track.mockResolvedValue(staffDetail);
    renderInApp(<TrackView />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    await screen.findByRole('heading', { name: 'Warm-up' });
    expect(screen.queryByRole('link', { name: 'Edit Track' })).toBeNull();
  });
});

describe('TrackProgressView', () => {
  beforeEach(() => {
    api.trackProgress.mockResolvedValue({
      total: 4,
      items: [
        {
          user: { username: 'ada', display_name: 'Ada', avatar_url: null },
          role: 'solver',
          is_track_member: true,
          solved: 3,
        },
        {
          user: { username: 'grace', display_name: 'Grace', avatar_url: 'https://example.com/g.png' },
          role: null,
          is_track_member: true,
          solved: 0,
        },
      ],
    });
  });

  it.each(['owner', 'administrator', 'editor', 'observer'] as const)(
    'shows %s how far each person has got',
    async (role) => {
      renderInApp(<TrackProgressView />, { space: makeSpace(role) });
      expect(await screen.findByText('Ada')).toBeTruthy();
      expect(screen.getByRole('progressbar', { name: 'Progress of ada' }).getAttribute('aria-valuetext')).toBe(
        '3 of 4 solved'
      );
      expect(screen.getByRole('img', { name: 'Grace' }).getAttribute('src')).toBe('https://example.com/g.png');
      expect(screen.getByText('Not a member')).toBeTruthy();
    }
  );

  it('does not even ask Core when the person is a solver', () => {
    renderInApp(<TrackProgressView />, { space: makeSpace('solver') });
    expect(screen.getByText('Progression is for the Space’s staff')).toBeTruthy();
    expect(api.trackProgress).not.toHaveBeenCalled();
  });

  it('says when there is nobody to show', async () => {
    api.trackProgress.mockResolvedValue({ total: 4, items: [] });
    renderInApp(<TrackProgressView />, { space: makeSpace('owner') });
    expect(await screen.findByText('Nobody to show yet')).toBeTruthy();
  });
});
