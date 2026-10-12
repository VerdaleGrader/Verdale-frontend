import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { FakeEventSource, makeSubmission, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ slug: 'team', problemSlug: 'sum', submissionId: 's1' }),
}));
const submissionsApi = vi.hoisted(() => ({ get: vi.fn(), rejudge: vi.fn() }));
vi.mock('../api/submissions.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/submissions.api')>()),
  submissionsApi,
}));

import { SubmissionDetail } from './submission-detail';

beforeEach(() => {
  vi.clearAllMocks();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

const judged = (overrides = {}) =>
  makeSubmission({
    status: 'completed',
    verdict: 'WA',
    time_ms: 40,
    memory_kb: 4096,
    tests_passed: 1,
    tests_total: 3,
    judged_at: '2026-10-11T00:01:00Z',
    results: [
      { position: 1, is_sample: true, verdict: 'AC', time_ms: 5, memory_kb: 1024 },
      { position: 2, is_sample: false, verdict: 'WA', time_ms: 40, memory_kb: 4096 },
      { position: 3, is_sample: false, verdict: 'SKIPPED', time_ms: 0, memory_kb: 0 },
    ],
    ...overrides,
  });

describe('the result of a submission (GRD-49)', () => {
  it('shows verdict, time, memory and tests passed, with the verdict explained in words', async () => {
    submissionsApi.get.mockResolvedValue(judged());
    renderInApp(<SubmissionDetail />);
    expect((await screen.findAllByText('Wrong answer on testcase 2')).length).toBeGreaterThan(0);
    // the slowest test, in the summary and again in that test's row
    expect(screen.getAllByText('40 ms')).toHaveLength(2);
    expect(screen.getAllByText('4.0 MB')).toHaveLength(2);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.getByText(/your program ran, but its output differs/i)).toBeTruthy();
  });

  it.each([
    ['AC', /printed the expected output for every testcase/],
    ['TLE', /took longer than the time limit/],
    ['MLE', /used more memory than the limit/],
    ['RE', /crashed while running/],
    ['CE', /did not compile/],
    ['OLE', /wrote more output than allowed/],
    ['ISE', /not caused by your code/],
  ] as const)('explains %s in plain words', async (verdict, words) => {
    submissionsApi.get.mockResolvedValue(
      makeSubmission({ status: 'completed', verdict, results: [], tests_passed: 0, can_rejudge: verdict === 'ISE' })
    );
    renderInApp(<SubmissionDetail />);
    expect(await screen.findByText(words)).toBeTruthy();
  });

  it('lists every test: sample ones and hidden ones, hidden ones with a verdict, time and memory only', async () => {
    submissionsApi.get.mockResolvedValue(judged());
    renderInApp(<SubmissionDetail />);
    const table = await screen.findByRole('table', { name: 'Testcase results' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Sample')).toBeTruthy();
    expect(within(rows[1]!).getByText('Hidden')).toBeTruthy();
    expect(within(rows[1]!).getByText('Wrong answer')).toBeTruthy();
    expect(within(rows[2]!).getByText('Skipped')).toBeTruthy();
    expect(screen.getByText(/Their data is never shown/)).toBeTruthy();
  });

  it('explains what went wrong on a failing sample test, never on a hidden one', async () => {
    submissionsApi.get.mockResolvedValue(
      judged({
        results: [
          {
            position: 1,
            is_sample: true,
            verdict: 'WA',
            time_ms: 5,
            memory_kb: 1024,
            stdout_preview: '4\n',
            checker_message: 'line 1: expected "3", got "4"',
          },
          {
            position: 2,
            is_sample: false,
            verdict: 'WA',
            time_ms: 40,
            memory_kb: 4096,
            stdout_preview: 'HIDDEN-LEAK',
            checker_message: 'HIDDEN-LEAK',
          },
        ],
      })
    );
    renderInApp(<SubmissionDetail />);
    expect(await screen.findByText('Sample testcase 1')).toBeTruthy();
    expect(screen.getByText('line 1: expected "3", got "4"')).toBeTruthy();
    expect(screen.queryByText(/Sample testcase 2/)).toBeNull();
    // Core never sends it; and even if it did, it is not shown for a test that is not a sample.
    expect(screen.queryByText(/HIDDEN-LEAK/)).toBeNull();
  });

  it('shows the compiler message and offers the rest of a long one', async () => {
    const message = 'main.cpp:1:1: error: expected unqualified-id\n'.repeat(100);
    submissionsApi.get.mockResolvedValue(
      makeSubmission({ status: 'completed', verdict: 'CE', compile_message: message, results: [], tests_passed: 0 })
    );
    renderInApp(<SubmissionDetail />);
    const heading = await screen.findByRole('heading', { name: 'Compiler message' });
    const block = heading.parentElement!.querySelector('pre')!;
    expect(block.textContent!.length).toBeLessThan(message.length);
    expect(block.textContent).toMatch(/…$/);
    await userEvent.click(screen.getByRole('button', { name: /Show the whole message \(\d+ characters\)/ }));
    expect(block.textContent).toBe(message);
    await userEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(block.textContent).toMatch(/…$/);
  });

  it('shows a short compiler message in full without a toggle', async () => {
    submissionsApi.get.mockResolvedValue(
      makeSubmission({ status: 'completed', verdict: 'CE', compile_message: 'error: oops', results: [] })
    );
    renderInApp(<SubmissionDetail />);
    expect(await screen.findByText('error: oops')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Show the whole message/ })).toBeNull();
  });

  it('shows the submitted code with a copy button', async () => {
    submissionsApi.get.mockResolvedValue(judged());
    renderInApp(<SubmissionDetail />);
    expect(await screen.findByText('int main() { return 0; }')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
  });

  it('follows a running submission live and updates in place', async () => {
    submissionsApi.get.mockResolvedValue(makeSubmission({ status: 'queued' }));
    renderInApp(<SubmissionDetail />);
    expect(await screen.findByText('Waiting for a judge')).toBeTruthy();
    expect(FakeEventSource.last.url).toBe('/api/v1/submissions/s1/events');
    act(() => FakeEventSource.last.push(makeSubmission({ status: 'running' })));
    expect(await screen.findByText('Running your solution')).toBeTruthy();
    act(() => FakeEventSource.last.push({ ...judged(), source: undefined } as never));
    expect((await screen.findAllByText('Wrong answer on testcase 2')).length).toBeGreaterThan(0);
    // the code is kept although the events do not carry it
    expect(screen.getByText('int main() { return 0; }')).toBeTruthy();
    expect(FakeEventSource.last.closed).toBe(true);
  });

  describe('a system error', () => {
    const ise = (overrides = {}) =>
      makeSubmission({
        status: 'completed',
        verdict: 'ISE',
        error_code: 'SANDBOX_FAILURE',
        results: [],
        tests_passed: 0,
        can_rejudge: true,
        ...overrides,
      });

    it('is said not to be the solver’s fault, with a way to check again', async () => {
      submissionsApi.get.mockResolvedValue(ise());
      submissionsApi.rejudge.mockResolvedValue(makeSubmission({ status: 'queued' }));
      renderInApp(<SubmissionDetail />);
      expect(await screen.findByText(/not caused by your code/)).toBeTruthy();
      expect(screen.getByText('Reference for support: SANDBOX_FAILURE')).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
      await waitFor(() => expect(submissionsApi.rejudge).toHaveBeenCalledWith('s1'));
      expect(await screen.findByText('Waiting for a judge')).toBeTruthy();
      await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(1));
    });

    it('offers no button when Core says it cannot be checked again', async () => {
      submissionsApi.get.mockResolvedValue(ise({ can_rejudge: false }));
      renderInApp(<SubmissionDetail />);
      await screen.findByText(/not caused by your code/);
      expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
    });

    it('shows why when checking again fails', async () => {
      submissionsApi.get.mockResolvedValue(ise());
      submissionsApi.rejudge.mockRejectedValue(
        new ApiError(429, 'RATE_LIMITED', 'Too many submissions. Try again in 30 seconds.')
      );
      renderInApp(<SubmissionDetail />);
      await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
      expect(await screen.findByText('Too many submissions. Try again in 30 seconds.')).toBeTruthy();
    });
  });

  it('says plainly when the submission is not there or not yours', async () => {
    submissionsApi.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Submission not found.'));
    renderInApp(<SubmissionDetail />);
    expect(await screen.findByText('Submission not found')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the problem' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum'
    );
  });

  it('offers a retry when loading fails for another reason', async () => {
    submissionsApi.get.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'Try again in a moment.'));
    submissionsApi.get.mockResolvedValue(judged());
    renderInApp(<SubmissionDetail />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByText('Wrong answer on testcase 2')).length).toBeGreaterThan(0);
  });
});
