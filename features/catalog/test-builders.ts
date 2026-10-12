import type { Collection, CollectionInTrack, CollectionSummary, ProblemRef, TrackDetail, TrackSummary } from './types';

/** Builders for Track and Collection tests. Not a test file itself. */

const STAMP = '2026-10-11T00:00:00Z';

export function makeTrackSummary(overrides: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id: 't1',
    name: 'Warm-up',
    slug: 'warm-up',
    description: 'Start here.',
    privacy: 'space',
    position: 1,
    archived: false,
    created_at: STAMP,
    updated_at: STAMP,
    collection_count: 2,
    problem_count: 4,
    progress: { solved: 1, total: 4 },
    is_member: false,
    ...overrides,
  };
}

export function makeProblemRef(slug: string, overrides: Partial<ProblemRef> = {}): ProblemRef {
  return {
    slug,
    title: `Problem ${slug}`,
    status: 'published',
    my_result: { solved: false, last_verdict: null },
    ...overrides,
  };
}

export function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'c1',
    name: 'Basics',
    slug: 'basics',
    description: '',
    archived: false,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function makeCollectionInTrack(overrides: Partial<CollectionInTrack> = {}): CollectionInTrack {
  const problems = overrides.problems ?? [makeProblemRef('sum'), makeProblemRef('max')];
  return { ...makeCollection(), problems, progress: { solved: 0, total: problems.length }, ...overrides };
}

export function makeCollectionSummary(overrides: Partial<CollectionSummary> = {}): CollectionSummary {
  return { ...makeCollection(), problem_count: 2, tracks: [], ...overrides };
}

export function makeTrackDetail(overrides: Partial<TrackDetail> = {}): TrackDetail {
  const { collection_count, problem_count, is_member, ...track } = makeTrackSummary();
  void collection_count;
  void problem_count;
  void is_member;
  return {
    ...track,
    space: { name: 'Team', slug: 'team' },
    collections: [makeCollectionInTrack()],
    member_count: null,
    ...overrides,
  };
}
