import { describe, expect, it } from 'vitest';
import { ApiError, unwrap } from './api';

const response = (status: number) => new Response(null, { status });

/** The ApiError an unwrap() call rejects with. */
async function failure(request: Parameters<typeof unwrap<unknown>>[0]): Promise<ApiError> {
  try {
    await unwrap<unknown>(request);
  } catch (caught) {
    return caught as ApiError;
  }
  throw new Error('expected unwrap to reject');
}

describe('unwrap', () => {
  it('returns the data of a successful call, and undefined for 204', async () => {
    expect(await unwrap(Promise.resolve({ data: { ok: true }, response: response(200) }))).toEqual({ ok: true });
    expect(await unwrap(Promise.resolve({ response: response(204) }))).toBeUndefined();
  });

  it('turns Core’s ErrorResponse into an ApiError with field messages', async () => {
    const error = {
      status: 400,
      error_code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      request_id: 'req-1',
      details: [{ field: 'slug', message: 'This slug is reserved.' }],
    };
    const thrown = await failure(Promise.resolve({ error, response: response(400) }));
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({ status: 400, errorCode: 'VALIDATION_FAILED', requestId: 'req-1' });
    expect(thrown.fieldError('slug')).toBe('This slug is reserved.');
    expect(thrown.fieldError('name')).toBeUndefined();
  });

  it('wraps an unreadable error body', async () => {
    const thrown = await failure(Promise.resolve({ error: 'oops', response: response(502) }));
    expect(thrown).toMatchObject({ status: 502, errorCode: 'UNKNOWN' });
  });

  it('reports an unreachable server with status 0 and a helpful message', async () => {
    const thrown = await failure(Promise.reject(new TypeError('fetch failed')));
    expect(thrown).toMatchObject({ status: 0, errorCode: 'NETWORK' });
    expect(thrown.message).toMatch(/Could not reach the server/);
  });
});
