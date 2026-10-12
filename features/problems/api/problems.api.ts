import { coreApi } from '@/lib/api-client';
import { ApiError, unwrap } from '@/lib/api';
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

/** Does the Space already have a problem with this slug? Asked by owners and editors before they save a new one. */
async function problemSlugTaken(slug: string, problemSlug: string): Promise<boolean> {
  try {
    await unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/editor', { params: { path: { slug, problemSlug } } })
    );
    return true;
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return false;
    throw caught;
  }
}

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

  slugTaken: problemSlugTaken,

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

  /** Check and store one file (or pasted text) for a later save; the problem does not change until `saveTests`. */
  stageFile: (target: Target, source: File | { text: string }) =>
    unwrap(
      source instanceof Blob
        ? coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/files', {
            params: { path: path(target) },
            body: { file: source as unknown as string },
            bodySerializer: () => formData({ file: source }),
          })
        : coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/files', {
            params: { path: path(target) },
            body: source,
          })
    ),

  /** Everything the testcases page changed, in one go. 409 TESTS_CHANGED when someone saved meanwhile. */
  saveTests: (target: Target, body: Schemas['SaveTestCasesRequest']) =>
    unwrap(coreApi.PUT('/api/v1/spaces/{slug}/problems/{problemSlug}/tests', { params: { path: path(target) }, body })),

  /** A window of lines of a saved testcase file, for the preview (10 lines) and View all (1000 at a time). */
  testFileSlice: (target: Target, testId: string, side: 'input' | 'output', fromLine: number, maxLines: number) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/tests/{testId}/files/{side}', {
        params: {
          path: { ...path(target), testId, side },
          query: { from_line: fromLine, max_lines: maxLines },
        },
      })
    ),

  // --- generate expected output ------------------------------------------------

  startGenerate: (target: Target, body: Schemas['StartGenerateRequest']) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/generate', { params: { path: path(target) }, body })
    ),

  generateJob: (target: Target, jobId: string) =>
    unwrap(
      coreApi.GET('/api/v1/spaces/{slug}/problems/{problemSlug}/generate/{jobId}', {
        params: { path: { ...path(target), jobId } },
      })
    ),

  stopGenerate: (target: Target, jobId: string) =>
    unwrap(
      coreApi.POST('/api/v1/spaces/{slug}/problems/{problemSlug}/generate/{jobId}/stop', {
        params: { path: { ...path(target), jobId } },
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
