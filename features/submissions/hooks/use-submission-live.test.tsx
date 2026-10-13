import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Submission } from '../api/submissions.api';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../api/submissions.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/submissions.api')>()),
  submissionsApi: api,
}));

import { useSubmissionLive } from './use-submission-live';

/** Just enough of EventSource for the hook: events are pushed by the test. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  readyState = 1;
  closed = false;
  private listeners = new Map<string, Array<(event: unknown) => void>>();
  constructor(
    readonly url: string,
    readonly init?: EventSourceInit
  ) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  push(submission: Partial<Submission>) {
    this.emit('submission', { data: JSON.stringify(submission) });
  }
}

const submission = (overrides: Partial<Submission> = {}): Submission => ({
  id: 's1',
  version_major: 1,
  outdated: false,
  number: 1,
  problem: { slug: 'sum', title: 'Sum' },
  space: { name: 'Team', slug: 'team' },
  author: { username: 'sol', display_name: 'Sol', avatar_url: null },
  language: 'cpp',
  status: 'queued',
  verdict: null,
  time_ms: null,
  memory_kb: null,
  tests_passed: null,
  tests_total: 2,
  test_runs: [],
  created_at: '2026-10-11T00:00:00Z',
  judged_at: null,
  compile_message: null,
  error_code: null,
  results: [],
  can_rejudge: false,
  source: 'int main(){}',
  ...overrides,
});

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  api.get.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useSubmissionLive', () => {
  it('opens the event stream for the submission with the session cookie', () => {
    renderHook(() => useSubmissionLive('s1', submission()));
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]!.url).toBe('/api/v1/submissions/s1/events');
    expect(FakeEventSource.instances[0]!.init).toEqual({ withCredentials: true });
  });

  it('does nothing without an id', () => {
    renderHook(() => useSubmissionLive(null));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('follows queued → running → finished, keeps the source the events do not carry, and closes the stream', () => {
    const { result } = renderHook(() => useSubmissionLive('s1', submission()));
    const stream = FakeEventSource.instances[0]!;
    act(() => stream.emit('open'));
    expect(result.current.connection).toBe('live');
    act(() => stream.push({ ...submission({ status: 'running' }), source: undefined }));
    expect(result.current.submission).toMatchObject({ status: 'running', source: 'int main(){}' });
    act(() =>
      stream.push({ ...submission({ status: 'completed', verdict: 'AC', tests_passed: 2 }), source: undefined })
    );
    expect(result.current.submission).toMatchObject({ status: 'completed', verdict: 'AC', source: 'int main(){}' });
    expect(result.current.connection).toBe('done');
    expect(stream.closed).toBe(true);
  });

  it('ignores a malformed event; the next one carries the full state', () => {
    const { result } = renderHook(() => useSubmissionLive('s1', submission()));
    const stream = FakeEventSource.instances[0]!;
    act(() => stream.emit('submission', { data: '{not json' }));
    expect(result.current.submission?.status).toBe('queued');
    act(() => stream.push(submission({ status: 'running' })));
    expect(result.current.submission?.status).toBe('running');
  });

  it('lets the browser reconnect after a dropped connection', () => {
    const { result } = renderHook(() => useSubmissionLive('s1', submission()));
    const stream = FakeEventSource.instances[0]!;
    act(() => stream.emit('error'));
    expect(result.current.connection).toBe('reconnecting');
    expect(stream.closed).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
    act(() => stream.emit('open'));
    expect(result.current.connection).toBe('live');
  });

  it('polls instead when the stream is refused (closed by the browser)', async () => {
    api.get.mockResolvedValue(submission({ status: 'running' }));
    const { result } = renderHook(() => useSubmissionLive('s1', submission()));
    const stream = FakeEventSource.instances[0]!;
    act(() => {
      stream.readyState = 2;
      stream.emit('error');
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(result.current.submission?.status).toBe('running'));
    expect(result.current.connection).toBe('polling');
  });

  it('polls instead after the stream fails several times in a row', async () => {
    api.get.mockResolvedValue(submission({ status: 'queued' }));
    renderHook(() => useSubmissionLive('s1', submission()));
    const stream = FakeEventSource.instances[0]!;
    act(() => {
      stream.emit('error');
      stream.emit('error');
    });
    expect(api.get).not.toHaveBeenCalled();
    act(() => stream.emit('error'));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(stream.closed).toBe(true);
  });

  it('polls every couple of seconds until the submission finishes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', undefined);
    api.get
      .mockResolvedValueOnce(submission({ status: 'running' }))
      .mockResolvedValue(submission({ status: 'completed', verdict: 'WA' }));
    const { result } = renderHook(() => useSubmissionLive('s1', submission()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.submission?.status).toBe('running');
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.submission).toMatchObject({ status: 'completed', verdict: 'WA' });
    expect(result.current.connection).toBe('done');
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('keeps polling after an error and reports it', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', undefined);
    api.get
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(submission({ status: 'completed', verdict: 'AC' }));
    const { result } = renderHook(() => useSubmissionLive('s1', submission()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error?.message).toBe('offline');
    expect(result.current.connection).toBe('error');
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.submission?.verdict).toBe('AC');
  });

  it('closes the stream when the component goes away', () => {
    const { unmount } = renderHook(() => useSubmissionLive('s1', submission()));
    const stream = FakeEventSource.instances[0]!;
    unmount();
    expect(stream.closed).toBe(true);
  });

  it('restart() opens a new stream with the state it is given (after "check again")', () => {
    const finished = submission({ status: 'completed', verdict: 'ISE' });
    const { result } = renderHook(() => useSubmissionLive('s1', finished));
    act(() => FakeEventSource.instances[0]!.push(finished));
    expect(result.current.connection).toBe('done');
    act(() => result.current.restart(submission({ status: 'queued' })));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(result.current.submission?.status).toBe('queued');
  });

  it('starts over for a different submission', () => {
    const { result, rerender } = renderHook(({ id, initial }) => useSubmissionLive(id, initial), {
      initialProps: { id: 's1', initial: submission() },
    });
    act(() => FakeEventSource.instances[0]!.push(submission({ status: 'running' })));
    rerender({ id: 's2', initial: submission({ id: 's2' }) });
    expect(result.current.submission?.id).toBe('s2');
    expect(result.current.submission?.status).toBe('queued');
    expect(FakeEventSource.instances[0]!.closed).toBe(true);
    expect(FakeEventSource.instances[FakeEventSource.instances.length - 1]!.url).toBe('/api/v1/submissions/s2/events');
  });
});
