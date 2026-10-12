import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';
import type { Language, UpdateProblemRequest } from '../types';

type Schemas = components['schemas'];

export interface ProblemListParams {
  q?: string;
  status?: 'published' | 'draft' | 'archived' | 'all';
  mine?: boolean;
  page: number;
  pageSize: number;
}

interface Target {
  slug: string;
  problemSlug: string;
}

const path = ({ slug, problemSlug }: Target) => ({ slug, problemSlug });

/** The multipart parts the API expects. openapi-fetch sends a FormData body untouched. */
function formData(parts: Record<string, Blob | string | undefined>, fileNames: Record<string, string> = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries(parts)) {
    if (value === undefined) continue;
    if (typeof value === 'string') form.append(name, value);
    else form.append(name, value, fileNames[name] ?? (value instanceof File ? value.name : name));
  }
  return form;
}

/** Where a test file can be downloaded from (a plain link, so the browser saves it). */
export const testFileUrl = (target: Target, testId: string, side: 'input' | 'output') =>
  `/api/v1/spaces/${encodeURIComponent(target.slug)}/problems/${encodeURIComponent(target.problemSlug)}/tests/${testId}/${side}`;

/** Repository: pure calls to Core for problems, tests and reference solutions. Errors are ApiError (lib/api.ts). */
export const problemsApi = {
  list: (slug: string, { q, status, mine, page, pageSize }: ProblemListParams) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/problems', {
        params: {
          path: { slug },
          query: { q: q || undefined, status, mine: mine || undefined, page, page_size: pageSize },
        },
      })
    ),

  create: (slug: string, body: Schemas['CreateProblemRequest']) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/problems', { params: { path: { slug } }, body })),

  /** What a solver sees (an author sees a draft as a preview). */
  get: (target: Target) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}', { params: { path: path(target) } })),

  editor: (target: Target) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/editor', { params: { path: path(target) } })),

  update: (target: Target, body: UpdateProblemRequest) =>
    unwrap(coreApi.PATCH('/api/v1/spaces/{slug}/problems/{problemSlug}', { params: { path: path(target) }, body })),

  remove: (target: Target) =>
    unwrap(coreApi.DELETE('/api/v1/spaces/{slug}/problems/{problemSlug}', { params: { path: path(target) } })),

  publish: (target: Target) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/publish', { params: { path: path(target) } })),

  archive: (target: Target) =>
    unwrap(coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/archive', { params: { path: path(target) } })),

  uploadImage: (target: Target, file: File) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/images', {
        params: { path: path(target) },
        body: { file: file as unknown as string },
        bodySerializer: () => formData({ file }),
      })
    ),

  // --- tests -------------------------------------------------------------

  tests: (target: Target) =>
    unwrap(coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/tests', { params: { path: path(target) } })),

  addTest: (
    target: Target,
    input: Blob,
    output: Blob,
    isSample: boolean,
    names?: { input?: string; output?: string }
  ) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/tests', {
        params: { path: path(target) },
        body: { input: input as unknown as string, output: output as unknown as string, is_sample: isSample },
        bodySerializer: () =>
          formData(
            { input, output, is_sample: String(isSample) },
            { input: names?.input ?? 'input.txt', output: names?.output ?? 'output.txt' }
          ),
      })
    ),

  replaceTest: (target: Target, testId: string, files: { input?: File; output?: File }) =>
    unwrap(
      coreApi.PUT('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/{testId}', {
        params: { path: { ...path(target), testId } },
        body: { input: files.input as unknown as string, output: files.output as unknown as string },
        bodySerializer: () => formData({ input: files.input, output: files.output }),
      })
    ),

  setTestSample: (target: Target, testId: string, isSample: boolean) =>
    unwrap(
      coreApi.PATCH('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/{testId}', {
        params: { path: { ...path(target), testId } },
        body: { is_sample: isSample },
      })
    ),

  removeTest: (target: Target, testId: string) =>
    unwrap(
      coreApi.DELETE('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/{testId}', {
        params: { path: { ...path(target), testId } },
      })
    ),

  reorderTests: (target: Target, testIds: string[]) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/reorder', {
        params: { path: path(target) },
        body: { test_ids: testIds },
      })
    ),

  // --- reference solutions -------------------------------------------------

  solutions: async (target: Target) =>
    (
      await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/solutions', { params: { path: path(target) } })
      )
    ).items,

  addSolution: (target: Target, body: { language: Language; source: string; is_primary?: boolean }) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/solutions', { params: { path: path(target) }, body })
    ),

  updateSolution: (
    target: Target,
    solutionId: string,
    body: { language?: Language; source?: string; is_primary?: boolean }
  ) =>
    unwrap(
      coreApi.PATCH('/api/v1/spaces/{slug}/problems/{problemSlug}/solutions/{solutionId}', {
        params: { path: { ...path(target), solutionId } },
        body,
      })
    ),

  removeSolution: (target: Target, solutionId: string) =>
    unwrap(
      coreApi.DELETE('/api/v1/spaces/{slug}/problems/{problemSlug}/solutions/{solutionId}', {
        params: { path: { ...path(target), solutionId } },
      })
    ),
};

export type { Target as ProblemTarget };
