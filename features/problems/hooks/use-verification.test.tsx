import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEditor } from '../../test-support';
import type { VerificationRun } from '../types';

const api = vi.hoisted(() => ({ verify: vi.fn(), verification: vi.fn(), publish: vi.fn() }));
vi.mock('../api/problems.api', () => ({ problemsApi: api }));

import { useVerification } from './use-verification';

const run = (status: VerificationRun['status']): VerificationRun => ({
  id: 'r1',
  status,
  valid: status === 'passed',
  requested_by: { username: 'edith', display_name: 'Edith', avatar_url: null },
  created_at: '2026-10-13T00:00:00Z',
  finished_at: null,
  verdict: null,
  reason: null,
  tests_passed: null,
  tests_total: 2,
  max_time_ms: null,
  max_memory_kb: null,
  results: [],
});

describe('useVerification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((mock) => mock.mockReset());
  });
  afterEach(() => vi.useRealTimers());

  it('polls every 2 s while running and refreshes the editor when the run ends', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    api.verification.mockResolvedValueOnce(run('running')).mockResolvedValueOnce(run('passed'));
    const editor = makeEditor({ verification: run('queued') });
    const { result } = renderHook(() =>
      useVerification({ target: { slug: 'team', problemSlug: 'sum' }, editor, setEditor: vi.fn(), refresh })
    );
    expect(result.current.running).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(api.verification).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(api.verification).toHaveBeenCalledTimes(2);
  });
});
