import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiffView, firstDifference } from './diff-view';
import { ProblemStatement } from './problem-statement';
import { SampleIO } from './sample-io';
import { SubmissionTable } from './submission-table';
import { TestProgress, progressSummary } from './test-progress';
import { TestResultList } from './test-result-list';
import { VerdictBadge } from './verdict-badge';
import { VerdictInfo } from './verdict-info';
import { FINAL_VERDICTS, VERDICTS, type Verdict } from './verdict';
import { formatMemory, formatTime } from '@/lib/format';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('VerdictBadge', () => {
  it.each(FINAL_VERDICTS)('%s shows its icon and its full name, and not the code, by default', (verdict) => {
    const { container } = render(<VerdictBadge verdict={verdict} />);
    expect(screen.getByText(VERDICTS[verdict].label)).toBeTruthy();
    expect(screen.queryByText(VERDICTS[verdict].code)).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it.each(FINAL_VERDICTS)('%s in the short form shows the code and keeps the name for screen readers', (verdict) => {
    const { container } = render(<VerdictBadge verdict={verdict} format="short" />);
    expect(screen.getByText(VERDICTS[verdict].code)).toBeTruthy();
    expect(screen.getByText(VERDICTS[verdict].label).className).toContain('vd-sr');
    expect(container.querySelector(`[title="${VERDICTS[verdict].label}"]`)).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it.each(['QUEUED', 'RUNNING', 'SKIPPED'] as Verdict[])(
    '%s has no code, so the short form keeps its icon',
    (verdict) => {
      const { container } = render(<VerdictBadge verdict={verdict} format="short" />);
      expect(container.querySelector('svg')).toBeTruthy();
      expect(screen.getByText(VERDICTS[verdict].label).className).toContain('vd-sr');
    }
  );

  it('auto carries both forms; the stylesheet picks one by width', () => {
    const { container } = render(<VerdictBadge verdict="TLE" format="auto" />);
    expect(container.querySelector('.vd-verdict--auto')).toBeTruthy();
    expect(screen.getByText('Time limit exceeded')).toBeTruthy();
    expect(screen.getByText('TLE').getAttribute('aria-hidden')).toBe('true');
  });

  it('marks an internal error as the judge’s fault and not a normal verdict', () => {
    const { container } = render(<VerdictBadge verdict="ISE" />);
    expect(container.querySelector('.vd-verdict--ise')).toBeTruthy();
    expect(screen.getByText('Internal error')).toBeTruthy();
  });

  it('detail replaces the label', () => {
    render(<VerdictBadge verdict="WA" detail="Wrong answer on testcase 4" />);
    expect(screen.getByText('Wrong answer on testcase 4')).toBeTruthy();
  });
});

describe('TestProgress', () => {
  it('summarises in words', () => {
    expect(progressSummary(['AC', 'AC', 'RUNNING', 'QUEUED'])).toBe('Running testcase 3 of 4');
    expect(progressSummary(['AC', 'WA', 'SKIPPED'])).toBe('Wrong answer on testcase 2');
    expect(progressSummary(['AC', 'AC'])).toBe('Accepted');
    expect(progressSummary(['QUEUED', 'QUEUED'])).toBe('Queued');
    expect(progressSummary([])).toBe('No testcases yet');
  });

  it('is a progressbar with a value text and one titled cell per test', () => {
    render(<TestProgress results={['AC', 'AC', 'RUNNING', 'QUEUED']} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuetext')).toBe('Running testcase 3 of 4');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(within(bar).getAllByTitle(/^Testcase \d/)).toHaveLength(4);
    expect(screen.getByTitle('Testcase 3: Running')).toBeTruthy();
  });
});

describe('TestResultList', () => {
  it('marks hidden tests as hidden and right-aligns numbers with units', () => {
    render(
      <TestResultList
        rows={[
          { verdict: 'AC', timeMs: 124, memoryKb: 15564, sample: true },
          { verdict: 'TLE', timeMs: 2000 },
        ]}
      />
    );
    expect(screen.getByText('Sample')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByText('124 ms')).toBeTruthy();
    expect(screen.getByText('15.2 MB')).toBeTruthy();
    expect(screen.getByText('2 s')).toBeTruthy();
    expect(screen.getByText('Testcase results', { selector: 'caption' })).toBeTruthy();
  });
});

describe('SubmissionTable', () => {
  it('links the problem and highlights the current user row', () => {
    render(
      <SubmissionTable
        rows={[
          {
            id: 1,
            when: '2 min ago',
            problem: 'Two sum',
            href: '/p/two-sum',
            author: 'ada',
            language: 'C++',
            verdict: 'AC',
            timeMs: 31,
            memoryKb: 2048,
            selected: true,
          },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: 'Two sum' }).getAttribute('href')).toBe('/p/two-sum');
    expect(screen.getByRole('link', { name: 'Two sum' }).closest('tr')?.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('31 ms')).toBeTruthy();
  });
});

describe('ProblemStatement and SampleIO', () => {
  it('shows limits and the statement', () => {
    render(
      <ProblemStatement title="Two sum" space="algorithms" limits={{ timeMs: 1000, memoryMb: 256 }} author="ada">
        <p>Find two numbers.</p>
      </ProblemStatement>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Two sum' })).toBeTruthy();
    expect(screen.getByText('1 s')).toBeTruthy();
    expect(screen.getByText('256 MB')).toBeTruthy();
    expect(screen.getByText('Find two numbers.')).toBeTruthy();
  });

  it('SampleIO keeps the text byte for byte', () => {
    const input = '3\n1 2 3\n  \n';
    render(<SampleIO index={1} input={input} output="6\n" />);
    const pre = screen.getByLabelText('Sample 1').querySelectorAll('pre');
    expect(pre[0]!.textContent).toBe(input);
    expect(screen.getAllByRole('button', { name: /^Copy/ })).toHaveLength(2);
  });
});

describe('DiffView', () => {
  it('finds the first differing line and ignores trailing spaces', () => {
    expect(firstDifference('1\n2\n3', '1\n2   \n3\n')).toBe(-1);
    expect(firstDifference('1\n2\n3', '1\n5\n3')).toBe(1);
    expect(firstDifference('1\n2', '1')).toBe(1);
  });

  it('says it in words, not only in colour', () => {
    render(<DiffView expected={'1\n2'} actual={'1\n9'} />);
    expect(screen.getByRole('status').textContent).toContain(
      '1 of 2 lines differ. First difference at line 2, column 1: expected “2”, found “9”.'
    );
    expect(screen.getAllByText('(differs)')).toHaveLength(2);
  });

  it('marks the wrong and the expected character, and names an extra and a missing space', () => {
    const { container } = render(<DiffView expected={'5 0\n8 1'} actual={'5  0\n81'} />);
    expect(container.querySelectorAll('.cd-x').length).toBeGreaterThan(0);
    expect(container.querySelector('.cd-miss')).toBeTruthy();
    expect(screen.getByText(/^Line 1 has an extra space at column \d+\.$/)).toBeTruthy();
    expect(screen.getByText(/^Line 2 is missing a space at column 2\.$/)).toBeTruthy();
  });

  it('shows whitespace and line ends, and hides them again', async () => {
    const { container } = render(<DiffView expected={'1 2'} actual={'1 3'} />);
    expect(container.querySelector('.cd-ws')?.textContent).toBe('·');
    const lines = () => [...container.querySelectorAll('.cd-lines')].map((list) => list.textContent).join('');
    expect(lines()).toContain('↵');
    await userEvent.click(screen.getByRole('switch', { name: 'Show whitespace' }));
    expect(lines()).not.toContain('↵');
  });

  it('shows trailing spaces as ignored, without counting them as a difference', () => {
    const { container } = render(<DiffView expected={'ok'} actual={'ok  '} />);
    expect(container.querySelector('.cd-ign')).toBeTruthy();
  });

  it('names missing lines and extra lines', () => {
    render(<DiffView expected={'1\n2\n3'} actual={'1\n2'} />);
    expect(screen.getByText(/Line 3 is missing from the output/)).toBeTruthy();
    expect(screen.getByText('(no line 3 in output)')).toBeTruthy();
  });

  it('titles the left column as asked', () => {
    render(<DiffView expected="a" actual="b" expectedLabel="Saved" actualLabel="Generated" />);
    expect(screen.getByText(/^Saved/)).toBeTruthy();
    expect(screen.getByText(/^Generated/)).toBeTruthy();
  });

  it('folds matching lines of a long output and reveals them on request', async () => {
    const expected = Array.from({ length: 100 }, (_, index) => String(index)).join('\n');
    const actual = expected.replace('\n50\n', '\n5O\n');
    render(<DiffView expected={expected} actual={actual} />);
    expect(screen.getAllByText(/matching lines? hidden/).length).toBe(4);
    await userEvent.click(screen.getAllByRole('button', { name: 'Show all' })[0]!);
    expect(screen.getAllByText(/matching lines? hidden/).length).toBe(2);
  });

  it('reports a match', () => {
    render(<DiffView expected="ok" actual="ok  " />);
    expect(screen.getByRole('status').textContent).toContain('matches');
  });
});

describe('formatters', () => {
  it('writes units with a space', () => {
    expect(formatTime(124)).toBe('124 ms');
    expect(formatTime(1250)).toBe('1.25 s');
    expect(formatTime(2000)).toBe('2 s');
    expect(formatMemory(15564)).toBe('15.2 MB');
    expect(formatMemory(512)).toBe('512 KB');
  });
});

describe('VerdictInfo', () => {
  it('opens a list of every verdict with its code and meaning, marking the current one', async () => {
    render(<VerdictInfo current="WA" />);
    await userEvent.click(screen.getByRole('button', { name: 'What do the verdicts mean?' }));
    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(11);
    expect(within(list).getByText('Time limit exceeded')).toBeTruthy();
    expect(within(list).getByText('TLE')).toBeTruthy();
    expect(within(list).getByText('The program ran longer than the time limit.')).toBeTruthy();
    const current = within(list)
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain('Wrong answer');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('SubmissionTable rows', () => {
  const rows = [
    {
      id: 1,
      when: '2 min ago',
      problem: 'Two sum',
      href: '/spaces/t/problems/two/submissions/1',
      author: 'ada',
      language: 'C++',
      verdict: 'AC' as const,
    },
  ];

  it('opens the submission from empty space, but not from text or the link', async () => {
    router.push.mockClear();
    render(<SubmissionTable rows={rows} />);
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.click(screen.getByText('2 min ago'));
    fireEvent.click(screen.getByText('ada'));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(router.push).toHaveBeenCalledWith('/spaces/t/problems/two/submissions/1');
  });

  it('keeps the problem link as the keyboard target and has no extra tab stop', () => {
    render(<SubmissionTable rows={rows} />);
    const row = screen.getAllByRole('row')[1]!;
    expect(row.getAttribute('tabindex')).toBeNull();
    expect(within(row).getByRole('link', { name: 'Two sum' }).getAttribute('href')).toBe(rows[0]!.href);
  });
});
