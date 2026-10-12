import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { problemsApi, statementPdfUrl } from './problems.api';

const target = { slug: 'Team', problemSlug: 'sum 1' };

describe('statementPdfUrl', () => {
  it('points at the /api proxy and asks for the draft only on request', () => {
    expect(statementPdfUrl(target)).toBe('/api/v1/spaces/Team/problems/sum%201/statement.pdf');
    expect(statementPdfUrl(target, true)).toBe('/api/v1/spaces/Team/problems/sum%201/statement.pdf?draft=true');
  });
});

describe('problemsApi.statementPdf', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the bytes with the session cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const bytes = await problemsApi.statementPdf(target, true);
    expect(bytes.byteLength).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith(statementPdfUrl(target, true), { credentials: 'include' });
  });

  it('turns an error body into an ApiError, and a dead network into NETWORK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 404, error_code: 'NOT_FOUND', message: 'No such problem.' }), {
          status: 404,
        })
      )
    );
    await expect(problemsApi.statementPdf(target, false)).rejects.toMatchObject({
      status: 404,
      errorCode: 'NOT_FOUND',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(problemsApi.statementPdf(target, false)).rejects.toMatchObject({ status: 0, errorCode: 'NETWORK' });
  });
});

describe('problemsApi.uploadStatementPdf', () => {
  class FakeRequest {
    static last: FakeRequest;
    method = '';
    url = '';
    withCredentials = false;
    responseType = '';
    status = 0;
    response: unknown = null;
    body: unknown;
    upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
    onload?: () => void;
    onerror?: () => void;
    constructor() {
      FakeRequest.last = this;
    }
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    send(body: unknown) {
      this.body = body;
    }
  }
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeRequest));
  afterEach(() => vi.unstubAllGlobals());

  const file = new File(['%PDF-'], 'a.pdf', { type: 'application/pdf' });

  it('PUTs a multipart file with credentials and reports progress', async () => {
    const progress = vi.fn();
    const sent = problemsApi.uploadStatementPdf(target, file, progress);
    const request = FakeRequest.last;
    expect(request.method).toBe('PUT');
    expect(request.url).toBe('/api/v1/spaces/Team/problems/sum%201/statement-pdf');
    expect(request.withCredentials).toBe(true);
    expect((request.body as FormData).get('file')).toBeInstanceOf(File);
    request.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    expect(progress).toHaveBeenCalledWith(25);
    request.status = 200;
    request.response = { slug: 'sum' };
    request.onload?.();
    await expect(sent).resolves.toEqual({ slug: 'sum' });
  });

  it('rejects with the field message Core gave, or NETWORK when the request fails', async () => {
    const failed = problemsApi.uploadStatementPdf(target, file);
    const request = FakeRequest.last;
    request.status = 400;
    request.response = {
      status: 400,
      error_code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      details: [{ field: 'file', message: 'The PDF has more than 10 pages.' }],
    };
    request.onload?.();
    const error = (await failed.catch((caught: unknown) => caught)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.fieldError('file')).toBe('The PDF has more than 10 pages.');

    const offline = problemsApi.uploadStatementPdf(target, file);
    FakeRequest.last.onerror?.();
    await expect(offline).rejects.toMatchObject({ status: 0, errorCode: 'NETWORK' });
  });
});
