import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';

type Schemas = components['schemas'];

export type Submission = Schemas['Submission'];
export type SubmissionSummary = Schemas['SubmissionSummary'];
export type SubmissionTestResult = Schemas['SubmissionTestResult'];

interface Target {
  slug: string;
  problemSlug: string;
}

/** Repository for submissions. Errors are ApiError (lib/api.ts). */
export const submissionsApi = {
  create: ({ slug, problemSlug }: Target, body: { language: Schemas['Language']; source: string }) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/submissions', {
        params: { path: { slug, problemSlug } },
        body,
      })
    ),

  list: ({ slug, problemSlug }: Target, params: { scope: 'mine' | 'all'; page: number; pageSize: number }) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/submissions', {
        params: {
          path: { slug, problemSlug },
          query: { scope: params.scope, page: params.page, page_size: params.pageSize },
        },
      })
    ),

  get: (submissionId: string) =>
    unwrap(coreApi.GET('/api/v1/submissions/{submissionId}', { params: { path: { submissionId } } })),

  rejudge: (submissionId: string) =>
    unwrap(coreApi.POST('/api/v1/submissions/{submissionId}/rejudge', { params: { path: { submissionId } } })),
};

/** Server-Sent Events for one submission (the browser's EventSource sends the session cookie). */
export const submissionEventsUrl = (submissionId: string) => `/api/v1/submissions/${submissionId}/events`;
