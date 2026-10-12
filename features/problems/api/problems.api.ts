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

/** Where the PDF statement is served from. `draft` asks owners and editors for the draft's file. */
export const statementPdfUrl = (target: Target, options: { draft?: boolean } = {}) =>
  `/api/v1/spaces/${encodeURIComponent(target.slug)}/problems/${encodeURIComponent(target.problemSlug)}/statement/pdf${
    options.draft ? '?draft=true' : ''
  }`;

/**
 * Uploads the PDF statement with progress. fetch cannot report upload progress, so this one call uses
 * XMLHttpRequest; the answer is handled like any other call (ApiError for a refusal).
 */
function uploadStatementPdf(
  target: Target,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<Schemas['ProblemEditor']> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', statementPdfUrl(target));
    request.withCredentials = true;
    request.responseType = 'json';
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onerror = () =>
      reject(new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.'));
    request.onabort = () => reject(new ApiError(0, 'ABORTED', 'The upload was cancelled.'));
    request.onload = () => {
      const body: unknown = request.response;
      if (request.status >= 200 && request.status < 300 && body) {
        onProgress(1);
        resolve(body as Schemas['ProblemEditor']);
      } else if (typeof body === 'object' && body !== null && 'error_code' in body) {
        const failure = body as Schemas['ErrorResponse'];
        reject(new ApiError(failure.status, failure.error_code, failure.message, failure.details, failure.request_id));
      } else {
        reject(new ApiError(request.status, 'UNKNOWN', 'Something went wrong. Try again.'));
      }
    };
    signal?.addEventListener('abort', () => request.abort());
    request.send(formData({ file }));
  });
}

/** Where a test file can be downloaded from (a plain link, so the browser saves it). */
export const testFileUrl = (target: Target, testId: string, side: 'input' | 'output') =>
  `/api/v1/spaces/${encodeURIComponent(target.slug)}/problems/${encodeURIComponent(target.problemSlug)}/tests/${testId}/${side}`;

/** The most problems one request returns (Core caps `page_size`). */
const MAX_PAGE_SIZE = 50;
/** Safety stop for "load everything": 20 pages is 1 000 problems, far past what a Space is meant to hold. */
const MAX_PAGES = 20;

/** Repository: pure calls to Core for problems, tests and reference solutions. Errors are ApiError (lib/api.ts). */
export const problemsApi = {
  /** Every problem of the Space, any status (owners and editors), fetched page by page. */
  listAll: async (slug: string) => {
    const items: Schemas['ProblemSummary'][] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await unwrap(
        coreApi.GET('/api/v1/spaces/{slug}/problems', {
          params: { path: { slug }, query: { status: 'all', page, page_size: MAX_PAGE_SIZE } },
        })
      );
      items.push(...result.items);
      if (items.length >= result.total || result.items.length === 0) break;
    }
    return items;
  },

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

  uploadStatementPdf,

  /** The limits the editor must respect, for the create page (no problem exists yet to carry them). */
  constraints: () => unwrap(coreApi.GET('/api/v1/problem-constraints')),

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
