import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { currentUrl, resetNavigation } from '@/features/test-navigation';
import { makeSpace, makeSubmission, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => import('@/features/test-navigation'));
const reviewApi = vi.hoisted(() => ({ list: vi.fn(), test: vi.fn() }));
vi.mock('../../api/review.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/review.api')>()),
  reviewApi,
}));
const submissionsApi = vi.hoisted(() => ({ get: vi.fn(), rejudge: vi.fn() }));
vi.mock('../../api/submissions.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/submissions.api')>()),
  submissionsApi,
}));
vi.mock('../../hooks/use-submission-live', () => ({
  useSubmissionLive: (_id: string, initial: unknown) => ({
    submission: initial,
    connection: 'done',
    error: null,
    restart: vi.fn(),
  }),
}));
vi.mock('@/features/problems/api/problems.api', () => ({
  problemsApi: {
    get: vi.fn().mockResolvedValue({ title: 'Sum', version_number: 3, time_limit_ms: 1000, memory_limit_kb: 262144 }),
    tests: vi.fn().mockResolvedValue({ summary: { count: 4, sample_count: 1 } }),
  },
}));
vi.mock('@/components/code/code-editor', () => ({
  CodeEditor: ({ value, label }: { value: string; label: string }) => <pre aria-label={label}>{value}</pre>,
}));

import { SubmissionReview } from './submission-review';

const ID = 'a1b2c3d4-0000-4000-8000-000000000000';
const results = [
  { position: 1, is_sample: true, verdict: 'AC', time_ms: 6, memory_kb: 3400 },
  { position: 2, is_sample: false, verdict: 'AC', time_ms: 31, memory_kb: 3400 },
  { position: 3, is_sample: false, verdict: 'WA', time_ms: 48, memory_kb: 3482 },
  { position: 4, is_sample: false, verdict: 'SKIPPED', time_ms: 0, memory_kb: 0 },
];
const wa = (over = {}) =>
  makeSubmission({
    id: ID,
    status: 'completed',
    verdict: 'WA',
    tests_passed: 2,
    tests_total: 4,
    time_ms: 48,
    memory_kb: 3482,
    results: results as never,
    source: 'int main() {}\n',
    ...over,
  });
const part = (lines: string[], over = {}) => ({
  lines,
  from_line: 1,
  to_line: lines.length,
  total_lines: lines.length,
  size_bytes: lines.join('\n').length + 1,
  line_truncated: false,
  cut: false,
  ...over,
});
const detail = (over: object = {}) => ({
  submission_id: ID,
  position: 3,
  verdict: 'WA',
  is_sample: false,
  time_ms: 48,
  memory_kb: 3482,
  exit_code: 0,
  signal: null,
  input: part(['6 9']),
  expected: part(['5', '1 4', '2 3']),
  output: part(['5', '1 4 ', '3 2']),
  stderr: part([]),
  ...over,
});
const sibling = (id: string, over = {}) => ({
  id,
  created_at: '2026-10-11T00:00:00Z',
  member: { username: 'sol', display_name: 'Sol', avatar_url: null },
  problem: { slug: 'sum', title: 'Sum of two numbers' },
  track: { name: 'Week 1', slug: 'w1' },
  version: 3,
  language: 'cpp',
  status: 'completed',
  verdict: 'WA',
  tests_passed: 1,
  tests_total: 4,
  time_ms: 1,
  memory_kb: 1,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigation(`/spaces/team/submissions/${ID}`, { slug: 'team', submissionId: ID });
  submissionsApi.get.mockResolvedValue(wa());
  reviewApi.list.mockResolvedValue({
    items: [sibling('newer'), sibling(ID), sibling('older')],
    page: 1,
    page_size: 50,
    total: 3,
  });
  reviewApi.test.mockResolvedValue(detail());
});

describe('submission detail for staff', () => {
  it('is not available to a solver and fetches nothing', async () => {
    renderInApp(<SubmissionReview />, { space: makeSpace('solver') });
    expect(await screen.findByText('Submissions aren’t available')).toBeTruthy();
    expect(submissionsApi.get).not.toHaveBeenCalled();
  });

  it('answers a missing submission, and one from another Space, with the same 404 page', async () => {
    submissionsApi.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'no'));
    const first = renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('This submission isn’t available')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to submissions' }).getAttribute('href')).toBe(
      '/spaces/team/submissions'
    );
    first.unmount();
    submissionsApi.get.mockResolvedValue(wa({ space: { name: 'Other', slug: 'other' } }));
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('This submission isn’t available')).toBeTruthy();
  });

  it('shows an error with retry when the submission cannot be loaded', async () => {
    submissionsApi.get.mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'x', [], 'req_1'));
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('The submission could not be loaded')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Submission')).toBeTruthy();
  });

  it('shows the summary, the testcase list with the failing testcase open, and nothing that changes the submission', async () => {
    renderInApp(<SubmissionReview />, { space: makeSpace('observer') });
    expect(await screen.findByRole('heading', { name: 'Testcase 3' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Submission #a1b2c3d4/ })).toBeTruthy();
    expect(screen.getAllByText('Wrong answer on testcase 3').length).toBeGreaterThan(0);
    expect(screen.getByText('2 / 4')).toBeTruthy();
    expect(screen.getAllByText('48 ms').length).toBeGreaterThan(0);
    expect(screen.getByText('Track: Week 1')).toBeTruthy();
    expect(screen.getByText('Problem version 3 (current)')).toBeTruthy();
    const list = screen.getByRole('complementary', { name: 'Testcases' });
    expect(within(list).getByText('Hidden from solvers')).toBeTruthy();
    expect(
      within(list)
        .getByRole('button', { name: /Testcase 3/ })
        .getAttribute('aria-current')
    ).toBe('true');
    expect(screen.queryByRole('button', { name: /check again|rejudge/i })).toBeNull();
    expect(reviewApi.test).toHaveBeenCalledWith(ID, 3, { maxLines: 1000 });
  });

  it('shows the character diff with the output and expected output, whitespace visible, and the input', async () => {
    const { container } = renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    await screen.findByText('Input · 1 line · 4 bytes');
    expect(screen.getByText(/1 of 3 lines differ/)).toBeTruthy();
    expect(container.querySelectorAll('.cd-x').length).toBeGreaterThan(0);
    expect(container.querySelector('.cd-ign')).toBeTruthy();
    const columns = screen.getByRole('group', { name: /compared with expected output/ });
    expect(
      within(columns)
        .getAllByText(/lines$/)
        .map((node) => node.textContent)
    ).toEqual(['Output (Sol) · 3 lines', 'Expected output · 3 lines']);
  });

  it('opens another testcase from the list and keeps it in the URL', async () => {
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    await screen.findByRole('heading', { name: 'Testcase 3' });
    reviewApi.test.mockResolvedValue(detail({ position: 2, verdict: 'AC', output: part(['5', '1 4', '2 3']) }));
    await userEvent.click(
      within(screen.getByRole('complementary', { name: 'Testcases' })).getByRole('button', { name: /Testcase 2/ })
    );
    expect(currentUrl()).toContain('test=2');
    expect(await screen.findByRole('heading', { name: 'Testcase 2' })).toBeTruthy();
    expect(await screen.findByText('Output matches the expected output.')).toBeTruthy();
  });

  it('opens a skipped testcase without asking Core for files', async () => {
    resetNavigation(`/spaces/team/submissions/${ID}?test=4`, { slug: 'team', submissionId: ID });
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('Not run: judging stops at the first failed testcase.')).toBeTruthy();
    expect(reviewApi.test).not.toHaveBeenCalled();
  });

  it('says when a testcase file could not be loaded and tries again', async () => {
    reviewApi.test.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'x'));
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('Testcase 3 could not be loaded.')).toBeTruthy();
    expect(screen.getByText(/The verdict above is still correct/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/lines differ/)).toBeTruthy();
  });

  it('says when the expected output cannot be read', async () => {
    reviewApi.test.mockResolvedValue(detail({ expected: part([], { unavailable: true }) }));
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('Expected output for testcase 3 could not be loaded.')).toBeTruthy();
  });

  it('summarises a runtime error with cause, signal and the output before the stop, above the raw stderr', async () => {
    submissionsApi.get.mockResolvedValue(
      wa({
        verdict: 'RE',
        results: [{ position: 1, is_sample: false, verdict: 'RE', time_ms: 12, memory_kb: 3000 }] as never,
      })
    );
    reviewApi.test.mockResolvedValue(
      detail({
        position: 1,
        verdict: 'RE',
        exit_code: 134,
        signal: 6,
        expected: part(['2', '0 6', '1 5']),
        output: part(['2', '0 6']),
        stderr: part(["terminate called after throwing an instance of 'std::out_of_range'", '  what():  vector::at']),
      })
    );
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('The program stopped on an uncaught exception: std::out_of_range')).toBeTruthy();
    expect(screen.getByText('SIGABRT (6) · exit code 134')).toBeTruthy();
    expect(screen.getByText('2 of 3 expected lines were printed. All of them match.')).toBeTruthy();
    expect(screen.getByText(/Standard error \(raw\) · 2 lines/)).toBeTruthy();
    expect(screen.getByText('(stopped before line 3)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download stderr' })).toBeTruthy();
  });

  it('folds a long output, loads the next window on request and says what Judge kept', async () => {
    const expected = Array.from({ length: 1000 }, (_, i) => `${i + 1}`);
    const printed = [...expected, ...Array.from({ length: 1000 }, () => 'x')];
    submissionsApi.get.mockResolvedValue(
      wa({
        verdict: 'OLE',
        results: [{ position: 1, is_sample: false, verdict: 'OLE', time_ms: 200, memory_kb: 4000 }] as never,
      })
    );
    reviewApi.test.mockImplementation(
      async (_id: string, _pos: number, window: { part?: string; fromLine?: number }) => {
        const from = window.fromLine ?? 1;
        const slice = (all: string[], extra = {}) =>
          part(all.slice(from - 1, from - 1 + 1000), { from_line: from, total_lines: all.length, ...extra });
        return detail({
          position: 1,
          verdict: 'OLE',
          exit_code: null,
          signal: 9,
          input: slice(['1000']),
          expected: slice(expected),
          output: slice([...printed, ...printed.slice(0, 500)], { cut: true }),
        });
      }
    );
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('The program printed more output than allowed and was stopped.')).toBeTruthy();
    // Matching lines and the long run of extra lines are folded, and the title counts the whole output.
    expect(await screen.findAllByText(/matching lines hidden/)).toHaveLength(2);
    expect(await screen.findAllByText(/extra lines hidden/)).toHaveLength(2);
    expect(screen.getByText(/Output \(Sol\) · 2,500 lines/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download output (stored part)' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Load the next/ }));
    await waitFor(() =>
      expect(reviewApi.test).toHaveBeenCalledWith(ID, 1, expect.objectContaining({ part: 'output', fromLine: 2001 }))
    );
  });

  it('goes to Older and Newer submissions of the same person on the same problem', async () => {
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    await screen.findByRole('heading', { name: 'Testcase 3' });
    expect(screen.getByRole('link', { name: 'Older submission' }).getAttribute('href')).toBe(
      '/spaces/team/submissions/older'
    );
    expect(screen.getByRole('link', { name: 'Newer submission' }).getAttribute('href')).toBe(
      '/spaces/team/submissions/newer'
    );
    expect(reviewApi.list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ member: 'sol', problem: 'sum' })
    );
  });

  it('disables Older at the first submission', async () => {
    reviewApi.list.mockResolvedValue({ items: [sibling(ID)], page: 1, page_size: 50, total: 1 });
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    await screen.findByRole('heading', { name: 'Testcase 3' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Older submission' }).hasAttribute('disabled')).toBe(true)
    );
  });

  it('notes that it was judged on an older version of the problem', async () => {
    reviewApi.list.mockResolvedValue({ items: [sibling(ID, { version: 2 })], page: 1, page_size: 50, total: 1 });
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText(/judged on version 2/)).toBeTruthy();
    expect(screen.getByText(/not the current version 3/)).toBeTruthy();
  });
});

describe('Code tab', () => {
  beforeEach(() => resetNavigation(`/spaces/team/submissions/${ID}?tab=code`, { slug: 'team', submissionId: ID }));

  it('shows the code read only with copy and download, and the file facts', async () => {
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByLabelText('Code of submission #a1b2c3d4')).toBeTruthy();
    expect(screen.getByText('main.cpp')).toBeTruthy();
    expect(screen.getByText('Read only')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
    expect(screen.getByText('1 line · 14 bytes')).toBeTruthy();
  });

  it('compares with another submission of the same person, chosen from a list and kept in the URL', async () => {
    submissionsApi.get.mockImplementation(async (id: string) =>
      id === 'older' ? wa({ id: 'older', source: 'int main() { return 1; }\n' }) : wa()
    );
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    await screen.findByLabelText('Code of submission #a1b2c3d4');
    await userEvent.click(await screen.findByRole('combobox', { name: /Compare with/ }));
    await userEvent.click(await screen.findByRole('option', { name: /#older/ }));
    expect(currentUrl()).toContain('compare=older');
    expect((await screen.findAllByText(/#older ·/)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/lines? differs?/)).toBeTruthy();
  });
});

describe('Compiler output tab', () => {
  it('opens by itself for a compilation error: errors with line and column, the code around them, the raw output', async () => {
    submissionsApi.get.mockResolvedValue(
      wa({
        verdict: 'CE',
        results: [],
        tests_passed: null,
        tests_total: null,
        time_ms: null,
        memory_kb: null,
        source: 'a\nb\nint x = need;\nd\n',
        compile_message: "main.cpp:3:9: error: 'need' was not declared\nmain.cpp:1:1: warning: unused",
      })
    );
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(
      await screen.findByText('The code did not compile: 1 error, 1 warning. No testcases were run.')
    ).toBeTruthy();
    expect(screen.getByText('line 3:9')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Code around the first error' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Compiler output' }).textContent).toContain('main.cpp:3:9: error');
    expect(screen.getByRole('link', { name: 'Open full code' }).getAttribute('href')).toContain('tab=code');
    expect(screen.getByRole('link', { name: /Testcases/ }).textContent).toContain('0');
  });

  it('shows raw output only when it is not in a format we can read, and says when there is none', async () => {
    submissionsApi.get.mockResolvedValue(wa({ verdict: 'CE', results: [], compile_message: 'SyntaxError: nope' }));
    const first = renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText(/not in a format we can summarise/)).toBeTruthy();
    first.unmount();
    submissionsApi.get.mockResolvedValue(wa({ compile_message: null }));
    resetNavigation(`/spaces/team/submissions/${ID}?tab=compiler`, { slug: 'team', submissionId: ID });
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('The compiler printed nothing for this submission.')).toBeTruthy();
  });
});

describe('a submission still being judged', () => {
  it('shows the progress and tells what can be read meanwhile', async () => {
    submissionsApi.get.mockResolvedValue(
      wa({
        status: 'running',
        verdict: null,
        results: results.slice(0, 2) as never,
        tests_passed: null,
        tests_total: 4,
      })
    );
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText(/Finished testcases can be opened now/)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    submissionsApi.get.mockResolvedValue(wa({ status: 'queued', verdict: null, results: [], tests_total: 4 }));
  });

  it('a queued one says the code can be read meanwhile', async () => {
    submissionsApi.get.mockResolvedValue(wa({ status: 'queued', verdict: null, results: [], tests_total: 4 }));
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('The code can be read in the Code tab while it waits.')).toBeTruthy();
    expect(screen.getByText('No testcase has finished yet.')).toBeTruthy();
  });

  it('an internal error names the judge reference instead of blaming the solver', async () => {
    submissionsApi.get.mockResolvedValue(
      wa({
        verdict: 'ISE',
        error_code: 'SANDBOX_FAILURE',
        results: [{ position: 1, is_sample: false, verdict: 'ISE', time_ms: 0, memory_kb: 0 }] as never,
      })
    );
    reviewApi.test.mockResolvedValue(detail({ position: 1, verdict: 'ISE' }));
    renderInApp(<SubmissionReview />, { space: makeSpace('editor') });
    expect(await screen.findByText('The judge failed while running testcase 1.')).toBeTruthy();
    expect(screen.getByText('SANDBOX_FAILURE')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check again|rejudge/i })).toBeNull();
  });
});
