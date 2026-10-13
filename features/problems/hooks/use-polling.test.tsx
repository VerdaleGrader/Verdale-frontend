import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './use-polling';

describe('usePolling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks every interval while enabled and stops on unmount', async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => usePolling(tick, true, 2000));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(tick).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(tick).toHaveBeenCalledTimes(3);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('does not tick while disabled and survives a failing tick', async () => {
    const tick = vi.fn().mockRejectedValue(new Error('boom'));
    const { rerender } = renderHook(({ on }) => usePolling(tick, on, 1000), { initialProps: { on: false } });
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(tick).not.toHaveBeenCalled();
    rerender({ on: true });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
