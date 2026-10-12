import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveStateLabel, useAutosave } from './use-autosave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(
  initial: { value: string; saved: string; enabled?: boolean },
  save = vi.fn().mockResolvedValue(undefined)
) {
  const hook = renderHook((props) => useAutosave({ ...props, save, delayMs: 1000 }), {
    initialProps: { enabled: true, ...initial },
  });
  return { ...hook, save };
}

describe('useAutosave', () => {
  it('is quiet while nothing differs from the saved copy', () => {
    const { result, save } = setup({ value: 'a', saved: 'a' });
    act(() => vi.advanceTimersByTime(5000));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(false);
    expect(saveStateLabel(result.current.state, result.current.dirty)).toBe('All changes saved');
  });

  it('saves once, a moment after typing stops, with the latest value', async () => {
    const { result, rerender, save } = setup({ value: 'a', saved: 'a' });
    rerender({ enabled: true, value: 'ab', saved: 'a' });
    expect(result.current.dirty).toBe(true);
    expect(saveStateLabel(result.current.state, result.current.dirty)).toBe('Unsaved changes');
    act(() => vi.advanceTimersByTime(600));
    rerender({ enabled: true, value: 'abc', saved: 'a' }); // typing again restarts the wait
    act(() => vi.advanceTimersByTime(600));
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(result.current.state.kind).toBe('saved');
  });

  it('shows "Saving…" while the request is out', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result, rerender } = setup({ value: 'a', saved: 'a' }, save);
    rerender({ enabled: true, value: 'b', saved: 'a' });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveStateLabel(result.current.state, result.current.dirty)).toBe('Saving…');
    await act(async () => finish());
    expect(result.current.state.kind).toBe('saved');
  });

  it('keeps the work and says why when a save fails, and retries on the next change', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Could not reach the server.')).mockResolvedValue(undefined);
    const { result, rerender } = setup({ value: 'a', saved: 'a' }, save);
    rerender({ enabled: true, value: 'b', saved: 'a' });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.state).toEqual({ kind: 'error', message: 'Could not reach the server.' });
    expect(saveStateLabel(result.current.state, result.current.dirty)).toBe('Not saved: Could not reach the server.');
    expect(result.current.dirty).toBe(true);
    rerender({ enabled: true, value: 'bc', saved: 'a' });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state.kind).toBe('saved');
  });

  it('"save now" does not wait for the timer', async () => {
    const { result, rerender, save } = setup({ value: 'a', saved: 'a' });
    rerender({ enabled: true, value: 'b', saved: 'a' });
    await act(async () => {
      await result.current.saveNow();
    });
    expect(save).toHaveBeenCalledWith('b');
  });

  it('does nothing when disabled (for example while the form has errors, or the problem is published)', () => {
    const { rerender, save } = setup({ value: 'a', saved: 'a', enabled: false });
    rerender({ enabled: false, value: 'b', saved: 'a' });
    act(() => vi.advanceTimersByTime(5000));
    expect(save).not.toHaveBeenCalled();
  });

  it('asks before the tab is closed while there is unsaved work, and not otherwise', () => {
    const { rerender } = setup({ value: 'a', saved: 'a' });
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(closing()).toBe(false);
    rerender({ enabled: true, value: 'b', saved: 'a' });
    expect(closing()).toBe(true);
    rerender({ enabled: true, value: 'b', saved: 'b' });
    expect(closing()).toBe(false);
  });

  it('tries one last save when the page is hidden or the editor is left', async () => {
    const { rerender, save, unmount } = setup({ value: 'a', saved: 'a' });
    rerender({ enabled: true, value: 'b', saved: 'a' });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(save).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    save.mockClear();
    rerender({ enabled: true, value: 'c', saved: 'a' });
    unmount();
    await Promise.resolve();
    expect(save).toHaveBeenCalledWith('c');
  });
});

describe('saveStateLabel', () => {
  it('names each state in words', () => {
    expect(saveStateLabel({ kind: 'saved', at: null }, false)).toBe('All changes saved');
    expect(saveStateLabel({ kind: 'saved', at: new Date(2026, 9, 11, 14, 5) }, false)).toMatch(/^Saved at /);
    expect(saveStateLabel({ kind: 'dirty' }, true)).toBe('Unsaved changes');
    expect(saveStateLabel({ kind: 'saving' }, true)).toBe('Saving…');
    expect(saveStateLabel({ kind: 'error', message: 'No.' }, true)).toBe('Not saved: No.');
  });
});
