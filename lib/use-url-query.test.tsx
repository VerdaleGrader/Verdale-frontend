import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUrl, goBack, navigationCounts, resetNavigation } from '@/features/test-navigation';
import { param, readUrlQuery, useDebouncedText, useUrlQuery } from './use-url-query';

vi.mock('next/navigation', () => import('@/features/test-navigation'));

const SCHEMA = {
  q: param.text(),
  status: param.oneOf(['published', 'draft', 'all'] as const, 'published'),
  page: param.page(),
};

function Harness() {
  const { values, set, filtered } = useUrlQuery(SCHEMA);
  const [draft, onChange] = useDebouncedText(values.q, (text) => set({ q: text }));
  return (
    <div>
      <input aria-label="Search" value={draft} onChange={(event) => onChange(event.target.value)} />
      <button onClick={() => set({ status: 'draft' })}>Drafts</button>
      <button onClick={() => set({ status: 'published' })}>Published</button>
      <button onClick={() => set({ page: values.page + 1 })}>Next</button>
      <output data-testid="state">{JSON.stringify(values)}</output>
      <output data-testid="filtered">{String(filtered)}</output>
    </div>
  );
}

const shown = () => JSON.parse(screen.getByTestId('state').textContent!);

describe('readUrlQuery', () => {
  it('uses defaults for missing and invalid values', () => {
    const query = new URLSearchParams('status=bogus&page=0&q=graph');
    expect(readUrlQuery(SCHEMA, query)).toEqual({ q: 'graph', status: 'published', page: 1 });
    expect(readUrlQuery(SCHEMA, new URLSearchParams('page=2.5'))).toMatchObject({ page: 1 });
    expect(readUrlQuery(SCHEMA, new URLSearchParams('page=3&status=draft'))).toMatchObject({
      page: 3,
      status: 'draft',
    });
  });
});

describe('useUrlQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetNavigation('/spaces/team');
  });
  afterEach(() => vi.useRealTimers());

  it('reads the URL on first render', () => {
    resetNavigation('/spaces/team?status=draft&page=2');
    render(<Harness />);
    expect(shown()).toEqual({ q: '', status: 'draft', page: 2 });
    expect(screen.getByTestId('filtered').textContent).toBe('true');
  });

  it('writes a filter with replace and leaves default values out', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Drafts'));
    expect(currentUrl()).toBe('/spaces/team?status=draft');
    expect(navigationCounts()).toEqual({ pushes: 0, replaces: 1 });
    fireEvent.click(screen.getByText('Published'));
    expect(currentUrl()).toBe('/spaces/team');
  });

  it('pushes page changes, and a filter change goes back to page 1', () => {
    resetNavigation('/spaces/team?page=2');
    render(<Harness />);
    fireEvent.click(screen.getByText('Next'));
    expect(currentUrl()).toBe('/spaces/team?page=3');
    expect(navigationCounts().pushes).toBe(1);
    fireEvent.click(screen.getByText('Drafts'));
    expect(currentUrl()).toBe('/spaces/team?status=draft');
    // The filter replaced the page-3 entry, so Back returns to page 2.
    act(() => goBack());
    expect(shown().page).toBe(2);
  });

  it('keeps unrelated query parameters', () => {
    resetNavigation('/spaces/team?utm=1');
    render(<Harness />);
    fireEvent.click(screen.getByText('Drafts'));
    expect(currentUrl()).toBe('/spaces/team?utm=1&status=draft');
  });

  it('debounces typed search by 300 ms and trims it', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'gra' } });
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: ' graph ' } });
    act(() => void vi.advanceTimersByTime(299));
    expect(currentUrl()).toBe('/spaces/team');
    act(() => void vi.advanceTimersByTime(1));
    expect(currentUrl()).toBe('/spaces/team?q=graph');
    expect(input.value).toBe(' graph ');
  });

  it('shows the URL again when it changes some other way (Back, a link)', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'graph' } });
    act(() => void vi.advanceTimersByTime(300));
    expect(currentUrl()).toBe('/spaces/team?q=graph');
    // Another entry, then Back to the search.
    act(() => resetNavigation('/spaces/team?q=tree'));
    expect(input.value).toBe('tree');
  });
});
