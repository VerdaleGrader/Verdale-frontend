import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { currentUrl, resetNavigation } from '@/features/test-navigation';
import { ANONYMOUS, chooseOption, makeSpace, renderInApp } from '@/features/test-support';
import type { CollectionDetail, Track, TrackDetail, TrackMember } from '../types';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
// The in-memory navigation keeps the URL query (the Track editor's tab, the progress Track); push is also spied on.
vi.mock('next/navigation', async () => {
  const real = await import('@/features/test-navigation');
  const router = {
    ...real.useRouter(),
    push: (url: string) => {
      nav.push(url);
      real.useRouter().push(url);
    },
  };
  return { ...real, useRouter: () => router };
});
const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  reorder: vi.fn(),
  addCollections: vi.fn(),
  removeCollections: vi.fn(),
  reorderCollections: vi.fn(),
  members: vi.fn(),
  removeMember: vi.fn(),
  invites: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  myProgress: vi.fn(),
  memberProgress: vi.fn(),
  collections: vi.fn(),
  collection: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  archiveCollection: vi.fn(),
  restoreCollection: vi.fn(),
  addProblems: vi.fn(),
  removeProblems: vi.fn(),
  reorderProblems: vi.fn(),
}));
vi.mock('../api/tracks.api', () => ({ tracksApi: api }));
const problemsApi = vi.hoisted(() => ({ listAll: vi.fn() }));
vi.mock('@/features/problems/api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/problems/api/problems.api')>()),
  problemsApi,
}));

import { CollectionEditor } from './collection-editor';
import { ManageView } from './manage-view';
import { ProgressPage } from './progress-page';
import { TrackAccess } from './track-access';
import { TrackEditor } from './track-editor';
import { TrackOverview } from './track-overview';
import { TrackView } from './track-view';

const NOW = '2026-10-12T00:00:00Z';

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 't1',
    slug: 'basics',
    name: 'Basics',
    description: 'Start here',
    visibility: 'space',
    position: 1,
    archived_at: null,
    created_at: NOW,
    collection_count: 2,
    problem_count: 5,
    progress: null,
    ...overrides,
  };
}

function problem(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `p${n}`,
    slug: `prob-${n}`,
    title: `Problem ${n}`,
    status: 'published' as const,
    version_number: 1,
    position: n,
    solved: null,
    my_verdict: null,
    ...overrides,
  };
}

function detail(overrides: Partial<TrackDetail> = {}): TrackDetail {
  return {
    ...track(),
    collections: [
      {
        id: 'c1',
        slug: 'week-1',
        name: 'Week 1',
        description: 'Loops',
        archived_at: null,
        created_at: NOW,
        problem_count: 2,
        position: 1,
        progress: null,
        problems: [problem(1), problem(2)],
      },
      {
        id: 'c2',
        slug: 'week-2',
        name: 'Week 2',
        description: '',
        archived_at: null,
        created_at: NOW,
        problem_count: 1,
        position: 2,
        progress: null,
        problems: [problem(3)],
      },
    ],
    ...overrides,
  };
}

function collection(overrides: Partial<CollectionDetail> = {}): CollectionDetail {
  return {
    id: 'c1',
    slug: 'week-1',
    name: 'Week 1',
    description: 'Loops',
    archived_at: null,
    created_at: NOW,
    problem_count: 2,
    problems: [problem(1), problem(2, { status: 'draft' })],
    tracks: [{ id: 't1', slug: 'basics', name: 'Basics', position: 1 }],
    progress: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation('/spaces/team', { trackSlug: 'basics', collectionSlug: 'week-1' });
  api.members.mockResolvedValue([]);
  api.invites.mockResolvedValue([]);
});

describe('the Space overview as Tracks (GRD-84)', () => {
  it('lists the Tracks with counts and links to each', async () => {
    api.list.mockResolvedValue([
      track(),
      track({ id: 't2', slug: 'advanced', name: 'Advanced', problem_count: 1, collection_count: 1 }),
    ]);
    renderInApp(<TrackOverview />, { space: makeSpace('solver') });
    const basics = await screen.findByRole('link', { name: /Basics/ });
    expect(basics.getAttribute('href')).toBe('/spaces/team/tracks/basics');
    expect(basics.textContent).toContain('5 problems in 2 Collections');
    expect(screen.getByRole('link', { name: /Advanced/ }).textContent).toContain('1 problem in 1 Collection');
    expect(screen.queryByRole('link', { name: 'Manage Tracks' })).toBeNull(); // not for solvers
  });

  it('shows a solver’s progress as a bar with the numbers written out', async () => {
    api.list.mockResolvedValue([track({ progress: { solved: 3, total: 5 } })]);
    renderInApp(<TrackOverview />, { space: makeSpace('solver') });
    const bar = await screen.findByRole('progressbar', { name: 'Progress in Basics' });
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
    expect(screen.getByText('3 of 5 solved')).toBeTruthy();
  });

  it('shows owners and editors the privacy of each Track and a way to manage them', async () => {
    api.list.mockResolvedValue([track({ visibility: 'members' })]);
    renderInApp(<TrackOverview />, { space: makeSpace('editor') });
    expect(await screen.findByText('Only people added to the Track')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Manage Tracks' })[0]!.getAttribute('href')).toBe('/spaces/team/manage');
  });

  it('never shows the privacy badge to solvers', async () => {
    api.list.mockResolvedValue([track({ visibility: 'members' })]);
    renderInApp(<TrackOverview />, { space: makeSpace('solver') });
    await screen.findByRole('link', { name: /Basics/ });
    expect(screen.queryByText('Only people added to the Track')).toBeNull();
  });

  it.each([
    ['solver', ANONYMOUS, /If you were invited to a Track/],
    ['solver', undefined, /Tracks in this Space will appear here/],
    ['owner', undefined, /Create a Track, put a Collection of problems in it/],
  ] as const)('explains an empty list to a %s', async (role, auth, text) => {
    api.list.mockResolvedValue([]);
    renderInApp(<TrackOverview />, { space: makeSpace(role), ...(auth ? { auth } : {}) });
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('shows an error with a retry', async () => {
    api.list.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Internal server error.'));
    renderInApp(<TrackOverview />, { space: makeSpace('solver') });
    expect(await screen.findByText('Internal server error.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('a Track as a solver sees it (GRD-84)', () => {
  it('shows Collections and problems in order with the person’s verdicts and progress', async () => {
    const data = detail({
      progress: { solved: 1, total: 3 },
    });
    data.collections[0]!.progress = { solved: 1, total: 2 };
    data.collections[0]!.problems = [
      problem(1, { solved: true, my_verdict: 'AC' }),
      problem(2, { solved: false, my_verdict: 'WA' }),
    ];
    api.get.mockResolvedValue(data);
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    expect(await screen.findByRole('heading', { name: 'Basics', level: 2 })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Your progress in Basics' })).toBeTruthy();
    const week1 = screen.getByRole('list', { name: 'Problems in Week 1' });
    const rows = within(week1).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Problem 1'),
      expect.stringContaining('Problem 2'),
    ]);
    expect(within(rows[0]!).getByText('Accepted')).toBeTruthy();
    expect(within(rows[1]!).getByText('Wrong answer')).toBeTruthy();
    expect(within(rows[0]!).getByRole('link', { name: 'Problem 1' }).getAttribute('href')).toBe(
      '/spaces/team/problems/prob-1'
    );
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Week 1', 'Week 2']);
    expect(screen.queryByRole('link', { name: /Edit this Track/ })).toBeNull();
  });

  it('numbers the problems a person sees from 1, even when the Collection starts with a draft they cannot see', async () => {
    const data = detail();
    // Core keeps the Collection’s own positions: the draft was position 1, the visible ones follow.
    data.collections[0]!.problems = [problem(2, { position: 2 }), problem(3, { position: 3 })];
    api.get.mockResolvedValue(data);
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    const rows = within(await screen.findByRole('list', { name: 'Problems in Week 1' })).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('[aria-hidden]')?.textContent)).toEqual(['1', '2']);
  });

  it('asks a visitor to log in to submit, and shows no progress', async () => {
    api.get.mockResolvedValue(detail());
    renderInApp(<TrackView />, { space: makeSpace(null), auth: ANONYMOUS });
    expect(await screen.findByText(/browsing as a visitor/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      '/login?next=%2Fspaces%2Fteam%2Ftracks%2Fbasics'
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('marks drafts for owners and editors and links them to the editor, with a way to edit the Track', async () => {
    const data = detail();
    data.collections[0]!.problems = [problem(1), problem(2, { status: 'draft' })];
    api.get.mockResolvedValue(data);
    renderInApp(<TrackView />, { space: makeSpace('editor') });
    const row = (await screen.findByRole('link', { name: 'Problem 2' })).closest('li')!;
    expect(within(row).getByText('Draft')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'Problem 2' }).getAttribute('href')).toBe(
      '/spaces/team/problems/prob-2/edit'
    );
    expect(screen.getByRole('link', { name: /Edit this Track/ }).getAttribute('href')).toBe(
      '/spaces/team/manage/tracks/basics'
    );
  });

  it('says a Track that is missing, archived or members-only is not found', async () => {
    api.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Track not found.'));
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    expect(await screen.findByText('Track not found')).toBeTruthy();
    expect(screen.getByText(/open only to people who were invited to it/)).toBeTruthy();
  });

  it('explains an empty Track differently to people who can fill it', async () => {
    api.get.mockResolvedValue(detail({ collections: [] }));
    renderInApp(<TrackView />, { space: makeSpace('solver') });
    expect(await screen.findByText(/once the people who run this Space add them/)).toBeTruthy();
  });
});

describe('manage Tracks and Collections (GRD-83)', () => {
  it('lets administrators create Tracks and keeps observers view-only', async () => {
    api.list.mockResolvedValue([]);
    api.collections.mockResolvedValue([]);
    const first = renderInApp(<ManageView />, { space: makeSpace('administrator') });
    expect(await screen.findByRole('button', { name: 'New Track' })).toBeTruthy();
    first.unmount();
    renderInApp(<ManageView />, { space: makeSpace('observer') });
    expect(await screen.findByRole('heading', { name: 'Tracks' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Track' })).toBeNull();
  });

  it('is for the staff only', () => {
    renderInApp(<ManageView />, { space: makeSpace('solver') });
    expect(screen.getByText('Only the Space’s staff can open Track management')).toBeTruthy();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('lists active Tracks to reorder, archived ones to restore, and every Collection with its Tracks', async () => {
    api.list.mockResolvedValue([track(), track({ id: 't2', slug: 'old', name: 'Old', archived_at: NOW })]);
    api.collections.mockResolvedValue([
      collection(),
      collection({ id: 'c9', slug: 'loose', name: 'Loose', tracks: [] }),
    ]);
    renderInApp(<ManageView />, { space: makeSpace('editor') });
    expect(await screen.findByRole('list', { name: 'Tracks in order' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drag to reorder Basics' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore Old' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Collections' });
    expect(within(table).getByText('Basics')).toBeTruthy();
    expect(within(table).getByText('None (owners and editors only)')).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'Week 1' }).getAttribute('href')).toBe(
      '/spaces/team/manage/collections/week-1'
    );
  });

  it('sends the whole new order of the Tracks in one request', async () => {
    api.list.mockResolvedValue([track(), track({ id: 't2', slug: 'second', name: 'Second', position: 2 })]);
    api.collections.mockResolvedValue([]);
    api.reorder.mockResolvedValue([]);
    renderInApp(<ManageView />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('button', { name: 'Move Second, now 2 of 2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move up' }));
    await waitFor(() => expect(api.reorder).toHaveBeenCalledWith('team', ['t2', 't1']));
  });

  it('creates a Track and opens its editor', async () => {
    api.list.mockResolvedValue([]);
    api.collections.mockResolvedValue([]);
    api.create.mockResolvedValue(detail({ slug: 'week-one', name: 'Week One' }));
    renderInApp(<ManageView />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('button', { name: 'New Track' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Week One');
    expect((within(dialog).getByLabelText('Slug') as HTMLInputElement).value).toBe('week-one');
    await chooseOption('Who can see it', 'Only people added to the Track');
    expect(within(dialog).getByText(/Only people added to this Track/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Track' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith('team', {
        name: 'Week One',
        slug: 'week-one',
        description: '',
        visibility: 'members',
      })
    );
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/spaces/team/manage/tracks/week-one'));
  });

  it('shows a slug clash next to the slug', async () => {
    api.list.mockResolvedValue([]);
    api.collections.mockResolvedValue([]);
    api.create.mockRejectedValue(new ApiError(409, 'CONFLICT', 'A Track with this slug already exists in this Space.'));
    renderInApp(<ManageView />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('button', { name: 'New Track' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Basics');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Track' }));
    expect(await within(dialog).findByText('A Track with this slug already exists in this Space.')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('creates a Collection that starts in the chosen Tracks', async () => {
    api.list.mockResolvedValue([track(), track({ id: 't2', slug: 'second', name: 'Second' })]);
    api.collections.mockResolvedValue([]);
    api.createCollection.mockResolvedValue(collection({ slug: 'warm-up' }));
    renderInApp(<ManageView />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('button', { name: 'New Collection' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Warm up');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Second' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Collection' }));
    await waitFor(() =>
      expect(api.createCollection).toHaveBeenCalledWith('team', {
        name: 'Warm up',
        slug: 'warm-up',
        description: '',
        track_slugs: ['second'],
      })
    );
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/spaces/team/manage/collections/warm-up'));
  });

  it('is read-only in an archived Space', async () => {
    api.list.mockResolvedValue([track()]);
    api.collections.mockResolvedValue([]);
    renderInApp(<ManageView />, { space: makeSpace('owner', { archived_at: NOW }) });
    await screen.findByRole('list', { name: 'Tracks in order' });
    expect(screen.queryByRole('button', { name: 'New Track' })).toBeNull();
    // read-only: the order is shown, with neither a handle nor a move menu
    expect(screen.queryByRole('button', { name: 'Drag to reorder Basics' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Move Basics/ })).toBeNull();
  });
});

describe('the Collection editor (GRD-83)', () => {
  beforeEach(() => {
    api.collection.mockResolvedValue(collection());
    problemsApi.listAll.mockResolvedValue([
      { id: 'p1', slug: 'prob-1', title: 'Problem 1', status: 'published' },
      { id: 'p2', slug: 'prob-2', title: 'Problem 2', status: 'draft' },
      { id: 'p3', slug: 'prob-3', title: 'Problem 3', status: 'published' },
      { id: 'p4', slug: 'prob-4', title: 'Problem 4', status: 'archived' },
    ]);
  });

  it('shows what is in the Collection and what is not, with a mark on drafts', async () => {
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    const inside = await screen.findByRole('list', { name: 'In this Collection' });
    expect(within(inside).getAllByRole('listitem')).toHaveLength(2);
    expect(within(inside).getByText('Draft')).toBeTruthy();
    const outside = screen.getByRole('list', { name: 'Not in this Collection' });
    expect(within(outside).getByText('Problem 3')).toBeTruthy();
    expect(within(outside).getByText('Archived')).toBeTruthy();
  });

  it('adds several problems in one request, by slug', async () => {
    api.addProblems.mockResolvedValue(collection());
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Problem 3' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Problem 4' }));
    await userEvent.click(screen.getByRole('button', { name: /Add 2 selected/ }));
    await waitFor(() => expect(api.addProblems).toHaveBeenCalledWith('team', 'week-1', ['prob-3', 'prob-4']));
  });

  it('removes problems and reorders with the whole order', async () => {
    api.removeProblems.mockResolvedValue(collection());
    api.reorderProblems.mockResolvedValue(collection());
    renderInApp(<CollectionEditor />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('button', { name: 'Move Problem 2 up' }));
    await waitFor(() => expect(api.reorderProblems).toHaveBeenCalledWith('team', 'week-1', ['p2', 'p1']));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Problem 1' }));
    await userEvent.click(screen.getByRole('button', { name: /Remove 1 selected/ }));
    await waitFor(() => expect(api.removeProblems).toHaveBeenCalledWith('team', 'week-1', ['prob-1']));
  });

  it('says a Collection in no Track is invisible to solvers', async () => {
    api.collection.mockResolvedValue(collection({ tracks: [] }));
    renderInApp(<CollectionEditor />, { space: makeSpace('editor') });
    expect(await screen.findByText(/in no Track, so solvers cannot see it/)).toBeTruthy();
  });

  it('saves details and asks before archiving', async () => {
    api.updateCollection.mockResolvedValue(collection({ name: 'Week One' }));
    api.archiveCollection.mockResolvedValue(collection({ archived_at: NOW }));
    renderInApp(<CollectionEditor />, { space: makeSpace('owner') });
    const name = await screen.findByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Week One');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(api.updateCollection).toHaveBeenCalledWith('team', 'week-1', {
        name: 'Week One',
        slug: 'week-1',
        description: 'Loops',
      })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Archive Collection' }));
    expect(api.archiveCollection).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive Collection' }));
    await waitFor(() => expect(api.archiveCollection).toHaveBeenCalledWith('team', 'week-1'));
  });

  it('is for owners and editors only', () => {
    renderInApp(<CollectionEditor />, { space: makeSpace('solver') });
    expect(screen.getByText('Only the Space’s staff can open Track management')).toBeTruthy();
  });
});

describe('the Track editor (GRD-83, GRD-85)', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(detail());
    api.collections.mockResolvedValue([
      collection(),
      collection({ id: 'c2', slug: 'week-2', name: 'Week 2', problems: [problem(3)] }),
      collection({ id: 'c3', slug: 'extra', name: 'Extra', problems: [] }),
    ]);
  });

  it('puts the Track’s Collections in order and offers the others', async () => {
    renderInApp(<TrackEditor />, { space: makeSpace('editor') });
    const inside = await screen.findByRole('list', { name: 'In this Track' });
    expect(
      within(inside)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual([expect.stringContaining('Week 1'), expect.stringContaining('Week 2')]);
    expect(within(screen.getByRole('list', { name: 'Not in this Track' })).getByText('Extra')).toBeTruthy();
  });

  it('adds a Collection to the Track by slug and reorders with the whole order', async () => {
    api.addCollections.mockResolvedValue(detail());
    api.reorderCollections.mockResolvedValue(detail());
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Extra' }));
    await userEvent.click(screen.getByRole('button', { name: /Add 1 selected/ }));
    await waitFor(() => expect(api.addCollections).toHaveBeenCalledWith('team', 'basics', ['extra']));
    await userEvent.click(screen.getByRole('button', { name: 'Move Week 2 up' }));
    await waitFor(() => expect(api.reorderCollections).toHaveBeenCalledWith('team', 'basics', ['c2', 'c1']));
  });

  it('explains what each privacy level means and warns about the change before it is saved', async () => {
    api.update.mockResolvedValue(detail({ visibility: 'members' }));
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(screen.getByText(/Everyone who can see the Space sees this Track/)).toBeTruthy();
    await chooseOption('Who can see this Track', 'Only people added to the Track');
    expect(screen.getByText(/Only people added to this Track \(by invitation\) see it/)).toBeTruthy();
    expect(screen.getByText(/people who were not added to this Track stop seeing it/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('team', 'basics', {
        name: 'Basics',
        slug: 'basics',
        description: 'Start here',
        visibility: 'members',
      })
    );
  });

  it('asks before archiving a Track', async () => {
    api.archive.mockResolvedValue(detail({ archived_at: NOW }));
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive Track' }));
    expect(api.archive).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Solvers stop seeing this Track/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive Track' }));
    await waitFor(() => expect(api.archive).toHaveBeenCalledWith('team', 'basics'));
  });

  it('keeps the open section in the URL, and opens the one a link names', async () => {
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(currentUrl()).toBe('/spaces/team?tab=settings');
    await userEvent.click(screen.getByRole('tab', { name: /Collections/ }));
    expect(currentUrl()).toBe('/spaces/team');
  });

  it('starts on the section named in the URL, and ignores one it does not know', async () => {
    resetNavigation('/spaces/team?tab=settings', { trackSlug: 'basics' });
    const first = renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    expect((await screen.findByRole('tab', { name: 'Settings' })).getAttribute('aria-selected')).toBe('true');
    first.unmount();
    resetNavigation('/spaces/team?tab=nonsense', { trackSlug: 'basics' });
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    expect((await screen.findByRole('tab', { name: /Collections/ })).getAttribute('aria-selected')).toBe('true');
  });

  it('says a missing Track is not found', async () => {
    api.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Track not found.'));
    renderInApp(<TrackEditor />, { space: makeSpace('owner') });
    expect(await screen.findByText('Track not found')).toBeTruthy();
  });
});

const MEMBER: TrackMember = {
  username: 'nina',
  display_name: 'Nina',
  avatar_url: null,
  space_role: 'solver',
  joined_at: NOW,
};

describe('Track members and invitations (GRD-85)', () => {
  function renderAccess(editable = true) {
    return renderInApp(<TrackAccess trackSlug="basics" trackName="Basics" editable={editable} />, {
      space: makeSpace('owner'),
    });
  }

  it('lists the members with their role in the Space', async () => {
    api.members.mockResolvedValue([
      MEMBER,
      { ...MEMBER, username: 'edith', display_name: 'Edith', space_role: 'editor' },
    ]);
    renderAccess();
    const table = await screen.findByRole('table', { name: 'Members of Basics' });
    expect(within(table).getByText('Solver')).toBeTruthy();
    expect(within(table).getByText('Editor')).toBeTruthy();
  });

  it('removes a member only after confirming, and says they stay in the Space', async () => {
    api.members.mockResolvedValue([MEMBER]);
    api.removeMember.mockResolvedValue(undefined);
    renderAccess();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove nina from this Track' }));
    expect(api.removeMember).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/They stay a member of the Space/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove from Track' }));
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('team', 'basics', 'nina'));
  });

  it('says plainly that invited people join the Space as solvers', async () => {
    renderAccess();
    expect(await screen.findByText(/join/, { selector: 'p[role="note"]' })).toBeTruthy();
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('solver');
    expect(note.textContent).toContain('never makes anyone an owner or an editor');
  });

  it('creates a link with an expiry, shows it once, and offers to copy it', async () => {
    api.createInvite.mockResolvedValue({ link: '/invites/abc123token', token: 'abc123token' });
    renderAccess();
    await chooseOption('Expires after', '3 days');
    await userEvent.click(screen.getByRole('button', { name: 'Create invitation link' }));
    await waitFor(() =>
      expect(api.createInvite).toHaveBeenCalledWith('team', 'basics', { username: undefined, expires_in_days: 3 })
    );
    expect(await screen.findByText(`${window.location.origin}/invites/abc123token`)).toBeTruthy();
    expect(screen.getByText(/shown only once/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy link/ })).toBeTruthy();
  });

  it('invites a person by username', async () => {
    api.createInvite.mockResolvedValue({ invited_user: { username: 'nina' }, token: 't' });
    renderAccess();
    await userEvent.type(await screen.findByLabelText('Username (optional)'), 'nina');
    await userEvent.click(screen.getByRole('button', { name: 'Invite person' }));
    await waitFor(() =>
      expect(api.createInvite).toHaveBeenCalledWith('team', 'basics', { username: 'nina', expires_in_days: 7 })
    );
    expect(screen.queryByText(/shown only once/)).toBeNull();
  });

  it('shows who is not found or already invited next to the field', async () => {
    api.createInvite.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'No user with that username.'));
    renderAccess();
    await userEvent.type(await screen.findByLabelText('Username (optional)'), 'ghost');
    await userEvent.click(screen.getByRole('button', { name: 'Invite person' }));
    expect(await screen.findByText('No user with that username.')).toBeTruthy();
  });

  it('revokes an invitation only after confirming', async () => {
    api.invites.mockResolvedValue([
      {
        id: 'i1',
        space: { name: 'Team', slug: 'team' },
        role: 'solver',
        status: 'pending',
        expires_at: '2026-11-01T00:00:00Z',
        created_at: NOW,
        invited_by: { username: 'olivia', display_name: 'Olivia', avatar_url: null },
        invited_user: null,
        track: { name: 'Basics', slug: 'basics' },
      },
    ]);
    api.revokeInvite.mockResolvedValue(undefined);
    renderAccess();
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke invitation link' }));
    expect(api.revokeInvite).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke invitation' }));
    await waitFor(() => expect(api.revokeInvite).toHaveBeenCalledWith('team', 'basics', 'i1'));
  });

  it('is view-only without edit rights', async () => {
    api.members.mockResolvedValue([MEMBER]);
    renderAccess(false);
    await screen.findByRole('table', { name: 'Members of Basics' });
    expect(screen.queryByRole('button', { name: /Remove nina/ })).toBeNull();
    expect(screen.queryByText('Invite people to this Track')).toBeNull();
  });
});

describe('member progress (GRD-84)', () => {
  it('shows each solver’s progress in the Track and in every Collection', async () => {
    api.list.mockResolvedValue([track()]);
    api.memberProgress.mockResolvedValue([
      {
        user: { username: 'sol', display_name: 'Sol', avatar_url: null },
        role: 'solver',
        progress: { solved: 2, total: 3 },
        collections: [
          { id: 'c1', slug: 'week-1', name: 'Week 1', progress: { solved: 2, total: 2 } },
          { id: 'c2', slug: 'week-2', name: 'Week 2', progress: { solved: 0, total: 1 } },
        ],
      },
    ]);
    renderInApp(<ProgressPage />, { space: makeSpace('editor') });
    const table = await screen.findByRole('table', { name: 'Progress in Basics' });
    expect(within(table).getByText('Sol')).toBeTruthy();
    expect(within(table).getByText('2 of 3 solved')).toBeTruthy();
    expect(within(table).getByText('2/2')).toBeTruthy();
    expect(within(table).getByText('0/1')).toBeTruthy();
    expect(api.memberProgress).toHaveBeenCalledWith('team', 'basics');
  });

  it('keeps the chosen Track in the URL', async () => {
    api.list.mockResolvedValue([track(), track({ id: 't2', slug: 'advanced', name: 'Advanced' })]);
    api.memberProgress.mockResolvedValue([]);
    renderInApp(<ProgressPage />, { space: makeSpace('editor') });
    await screen.findByRole('combobox', { name: 'Track' });
    await chooseOption('Track', 'Advanced');
    expect(currentUrl()).toBe('/spaces/team?track=advanced');
    await waitFor(() => expect(api.memberProgress).toHaveBeenLastCalledWith('team', 'advanced'));
  });

  it('is for owners and editors', () => {
    renderInApp(<ProgressPage />, { space: makeSpace('solver') });
    expect(screen.getByText('Only the Space’s staff can open Track management')).toBeTruthy();
  });
});
