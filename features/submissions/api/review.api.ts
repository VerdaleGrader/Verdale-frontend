import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export type SpaceSubmissionRow = Schemas['SpaceSubmissionRow'];
export type MemberRollup = Schemas['MemberRollup'];
export type MemberProblem = Schemas['MemberProblem'];
export type TrackRollup = Schemas['TrackRollup'];
export type TrackProblemRollup = Schemas['TrackProblemRollup'];
export type ProblemRollup = Schemas['ProblemRollup'];
export type SubmissionTestDetail = Schemas['SubmissionTestDetail'];
export type SubmissionFilePart = Schemas['SubmissionFilePart'];
export type TrackPrivacy = Schemas['TrackPrivacy'];
export type Verdict = Schemas['Verdict'];
export type Language = Schemas['Language'];

export interface SubmissionFilters {
  member?: string;
  q?: string;
  problem?: string;
  /** A Track slug, or `none`. */
  track?: string;
  verdict?: Verdict;
  language?: Language;
  version?: number;
  sort?: 'newest' | 'oldest' | 'member' | 'tests_passed' | 'time';
  page: number;
  pageSize: number;
}

/** Empty strings and the "all" sentinels never reach Core. */
const given = (value: string | undefined) => (value && value !== 'all' ? value : undefined);

interface Space {
  slug: string;
}

/**
 * Repository for the Space-wide submission pages (owners, administrators, editors, observers; GRD-93).
 * Errors are ApiError (lib/api.ts): 403 or 404 for everyone else.
 */
export const reviewApi = {
  list: ({ slug }: Space, filters: SubmissionFilters) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions', {
        params: {
          path: { slug },
          query: {
            member: filters.member,
            q: filters.q || undefined,
            problem: filters.problem,
            track: given(filters.track),
            verdict: filters.verdict,
            language: filters.language,
            version: filters.version,
            sort: filters.sort,
            page: filters.page,
            page_size: filters.pageSize,
          },
        },
      })
    ),

  versions: ({ slug }: Space, problem?: string) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions/versions', { params: { path: { slug }, query: { problem } } })
    ),

  byMember: (
    { slug }: Space,
    params: {
      q?: string;
      role?: 'owner' | 'administrator' | 'editor' | 'observer' | 'solver' | 'none';
      track?: string;
      window?: 'any' | '7d' | '30d';
      sort?: 'last_submission' | 'solved' | 'name';
      hideEmpty?: boolean;
      page: number;
      pageSize: number;
    }
  ) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions/by-member', {
        params: {
          path: { slug },
          query: {
            q: params.q || undefined,
            role: params.role,
            track: given(params.track),
            window: params.window,
            sort: params.sort,
            hide_empty: params.hideEmpty === undefined ? undefined : params.hideEmpty ? 'true' : 'false',
            page: params.page,
            page_size: params.pageSize,
          },
        },
      })
    ),

  memberProblems: (
    { slug }: Space,
    username: string,
    params: {
      q?: string;
      track?: string;
      status?: 'all' | 'solved' | 'unsolved';
      sort?: 'last_submission' | 'attempts' | 'name';
      page: number;
      pageSize: number;
    }
  ) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions/by-member/{username}/problems', {
        params: {
          path: { slug, username },
          query: {
            q: params.q || undefined,
            track: given(params.track),
            status: params.status,
            sort: params.sort,
            page: params.page,
            page_size: params.pageSize,
          },
        },
      })
    ),

  byTrack: (
    { slug }: Space,
    params: { q?: string; privacy?: TrackPrivacy; sort?: 'track_order' | 'last_submission' | 'submissions' } = {}
  ) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions/by-track', {
        params: { path: { slug }, query: { q: params.q || undefined, privacy: params.privacy, sort: params.sort } },
      })
    ),

  trackProblems: (
    { slug }: Space,
    trackSlug: string,
    params: {
      q?: string;
      collection?: string;
      status?: 'all' | 'published' | 'draft' | 'archived';
      sort?: 'track_order' | 'solved_fewest' | 'last_submission';
    } = {}
  ) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions/by-track/{trackSlug}/problems', {
        params: {
          path: { slug, trackSlug },
          query: {
            q: params.q || undefined,
            collection: given(params.collection),
            status: params.status,
            sort: params.sort,
          },
        },
      })
    ),

  trackProgress: ({ slug }: Space, trackSlug: string) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/tracks/{trackSlug}/progress', { params: { path: { slug, trackSlug } } })),

  byProblem: (
    { slug }: Space,
    params: {
      q?: string;
      track?: string;
      status?: 'all' | 'published' | 'draft' | 'archived';
      sort?: 'last_submission' | 'submissions' | 'solved_fewest' | 'name';
      page: number;
      pageSize: number;
    }
  ) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/submissions/by-problem', {
        params: {
          path: { slug },
          query: {
            q: params.q || undefined,
            track: given(params.track),
            status: params.status,
            sort: params.sort,
            page: params.page,
            page_size: params.pageSize,
          },
        },
      })
    ),

  /** One test of a submission as windows of lines. `part` fetches one of the four, the others come back null. */
  test: (
    submissionId: string,
    position: number,
    window: { part?: 'input' | 'expected' | 'output' | 'stderr'; fromLine?: number; maxLines?: number } = {}
  ) =>
    unwrap(
      coreApi.GET('/api/v1/submissions/{submissionId}/tests/{position}', {
        params: {
          path: { submissionId, position },
          query: { part: window.part, from_line: window.fromLine, max_lines: window.maxLines },
        },
      })
    ),
};

/** Lines of a window per request; Core's maximum. */
export const WINDOW_LINES = 1000;
