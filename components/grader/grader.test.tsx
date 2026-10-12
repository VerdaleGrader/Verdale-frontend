import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiffView, firstDifference } from './diff-view';
import { ProblemStatement } from './problem-statement';
import { SampleIO } from './sample-io';
import { SubmissionTable } from './submission-table';
import { TestProgress, progressSummary } from './test-progress';
import { TestResultList } from './test-result-list';
import { VerdictBadge } from './verdict-badge';
import { FINAL_VERDICTS, VERDICTS } from './verdict';
import { formatMemory, formatTime } from '@/lib/format';

describe('VerdictBadge', () => {
  it.each(FINAL_VERDICTS)('%s shows its code and its full label, never colour alone', (verdict) => {
    const { container } = render(<VerdictBadge verdict={verdict} />);
    expect(screen.getByText(VERDICTS[verdict].label)).toBeTruthy();
    expect(screen.getByText(VERDICTS[verdict].code)).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('compact keeps the label for screen readers and a title', () => {
    const { container } = render(<VerdictBadge verdict="WA" compact />);
    expect(screen.getByText('Wrong answer').className).toContain('vd-sr');
    expect(container.querySelector('[title="Wrong answer"]')).toBeTruthy();
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

describe('SubmissionTable authors', () => {
  const row = { id: 1, when: 'now', problem: 'Two sum', language: 'C++', verdict: 'AC' as const };

  it('shows the picture of the author, or the initials without one', () => {
    render(
      <SubmissionTable
        rows={[
          { ...row, author: 'Ada Lovelace', authorAvatarUrl: 'https://example.com/ada.png' },
          { ...row, id: 2, author: 'Grace Hopper', authorAvatarUrl: null },
        ]}
      />
    );
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).getAttribute('src')).toBe('https://example.com/ada.png');
    expect(screen.getByRole('img', { name: 'Grace Hopper' }).textContent).toBe('GH');
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
    expect(screen.getByRole('status').textContent).toContain('Outputs differ from line 2.');
    expect(screen.getAllByText('(differs)')).toHaveLength(2);
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
