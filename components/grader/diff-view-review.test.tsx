import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ErrorState } from '@/components/states/states';
import { DiffView } from './diff-view';

describe('DiffView on the review pages', () => {
  it('can put the solver’s output first, copy each side and show the totals of files it only has the start of', () => {
    render(
      <DiffView
        expected="1\n2"
        actual="1\n3"
        actualLabel="Output (Ploy)"
        outputFirst
        copyable
        expectedTotal={1000}
        actualTotal={148212}
      />
    );
    const heads = [...document.querySelectorAll('.vd-diff__head span')].map((node) => node.textContent);
    expect(heads).toEqual(['Output (Ploy) · 148,212 lines', 'Expected output · 1,000 lines']);
    expect(screen.getByRole('button', { name: 'Copy output (ploy)' })).toBeTruthy();
  });

  it('lists the details inside the summary, the ignored ones last and quiet, with columns for spaces', () => {
    render(<DiffView expected={'a b\nok'} actual={'a  b\nok  '} />);
    const items = within(screen.getByRole('status')).getAllByRole('listitem');
    expect(items[0]!.textContent).toMatch(/^Line 1 has an extra space at column \d\.$/);
    expect(items.at(-1)!.textContent).toContain('ends with a space');
    expect(items.at(-1)!.className).toContain('is-muted');
  });

  it('shows only the columns when plain, with its own words for a missing line', () => {
    render(<DiffView expected={'1\n2'} actual={'1'} plain missingText={(line) => `(stopped before line ${line})`} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('(stopped before line 2)')).toBeTruthy();
  });

  it('folds a long run of extra lines after the first few and names it', () => {
    const expected = Array.from({ length: 50 }, (_, i) => `${i}`).join('\n');
    const actual = `${expected}\n${Array.from({ length: 100 }, () => 'x').join('\n')}`;
    render(<DiffView expected={expected} actual={actual} />);
    expect(screen.getAllByText('97 extra lines hidden')).toHaveLength(2);
    expect(screen.getByText(/Lines 51–150 are extra/)).toBeTruthy();
  });

  it('goes to a line inside a fold by opening it', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `${i}`);
    const actual = lines.map((line, i) => (i === 90 ? 'changed' : line)).join('\n');
    const { container } = render(<DiffView expected={lines.join('\n')} actual={actual} goToLine />);
    expect(container.querySelector('[data-line="30"]')).toBeNull();
    await userEvent.type(screen.getByLabelText('Go to line'), '30{Enter}');
    expect(container.querySelector('[data-line="30"]')).toBeTruthy();
  });

  it('wraps long lines on request', async () => {
    const { container } = render(<DiffView expected="a" actual="b" goToLine />);
    await userEvent.click(screen.getByRole('switch', { name: 'Wrap long lines' }));
    expect(container.querySelector('.vd-diff.is-wrapped')).toBeTruthy();
  });
});

describe('ErrorState, centred', () => {
  it('is the page-sized card with a retry and the reference', async () => {
    let retried = false;
    render(
      <ErrorState
        centered
        title="Submissions could not be loaded"
        description="Try again."
        reference="req_1"
        onRetry={() => (retried = true)}
      />
    );
    expect(screen.getByRole('alert').textContent).toContain('Reference: req_1');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retried).toBe(true);
  });
});
