import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, unwrap } from './api';

const original = window.location;
function stubLocation(pathname: string, search = '') {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { pathname, search, assign } });
  return assign;
}
afterEach(() => Object.defineProperty(window, 'location', { configurable: true, value: original }));

const refused = () =>
  Promise.resolve({
    error: {
      status: 403,
      error_code: 'LEGAL_ACCEPTANCE_REQUIRED',
      message: 'Please accept the updated Terms and Privacy Policy to continue.',
      request_id: 'r1',
    },
    response: new Response(null, { status: 403 }),
  });

describe('a call Core refuses until the Terms are accepted', () => {
  it('sends the person to the notice and remembers the page', async () => {
    const assign = stubLocation('/spaces/team', '?tab=members');
    await expect(unwrap(refused())).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith('/accept-terms?next=%2Fspaces%2Fteam%3Ftab%3Dmembers');
  });

  it.each(['/accept-terms', '/terms', '/privacy'])('does not loop on %s', async (path) => {
    const assign = stubLocation(path);
    await expect(unwrap(refused())).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});
