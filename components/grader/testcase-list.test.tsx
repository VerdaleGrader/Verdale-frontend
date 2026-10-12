import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { chooseOption } from '@/features/test-support';
import { TestcaseList, type TestcaseItem } from './testcase-list';

const items: TestcaseItem[] = [
  { id: 1, position: 1, sample: true, verdict: 'AC', timeMs: 6 },
  { id: 2, position: 2, sample: false, verdict: 'AC', timeMs: 31 },
  { id: 3, position: 3, sample: false, verdict: 'WA', timeMs: 48 },
  ...[4, 5, 6, 7, 8].map((position) => ({ id: position, position, sample: false, verdict: 'SKIPPED' as const })),
];

describe('TestcaseList', () => {
  it('groups samples and hidden testcases, marks the selected one and selects on press', async () => {
    const onSelect = vi.fn();
    render(<TestcaseList items={items} selectedId={3} onSelect={onSelect} />);
    expect(screen.getByText('8 testcases')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Samples' })).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Hidden from solvers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Testcase 3/ }).getAttribute('aria-current')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: /Testcase 2/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('shows each row with its time and a short verdict that keeps the full name for screen readers', () => {
    render(<TestcaseList items={items} onSelect={() => undefined} />);
    const row = screen.getByRole('button', { name: /Testcase 3/ });
    expect(row.textContent).toContain('48 ms');
    expect(within(row).getByText('WA')).toBeTruthy();
    expect(within(row).getByText('Wrong answer').className).toContain('vd-sr');
  });

  it('folds the long run of skipped testcases into one line and can show them all', async () => {
    render(<TestcaseList items={items} onSelect={() => undefined} />);
    expect(screen.queryByRole('button', { name: /Testcase 8/ })).toBeNull();
    expect(screen.getByText(/Testcases 6–8 skipped/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByRole('button', { name: /Testcase 8/ })).toBeTruthy();
  });

  it('filters to failed testcases and to samples, and says when nothing matches', async () => {
    render(<TestcaseList items={items} onSelect={() => undefined} />);
    await chooseOption('Show', 'Failed only');
    expect(screen.getAllByRole('button', { name: /Testcase/ })).toHaveLength(1);
    await chooseOption('Show', 'Samples');
    expect(screen.getAllByRole('button', { name: /Testcase/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Testcase 1/ })).toBeTruthy();
  });

  it('says so when a filter matches nothing', async () => {
    render(<TestcaseList items={items.slice(0, 2)} onSelect={() => undefined} />);
    await chooseOption('Show', 'Failed only');
    expect(screen.getByText('No testcases match this filter.')).toBeTruthy();
  });
});
