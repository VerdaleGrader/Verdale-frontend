import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { LANGUAGE_LABELS } from '@/features/problems/types';
import {
  ANONYMOUS,
  FakeEventSource,
  chooseOption,
  makeProblem,
  makeSpace,
  makeSubmission,
  makeSummary,
  renderInApp,
} from '@/features/test-support';

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: '/spaces/team/problems/sum' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, refresh: vi.fn() }),
  useParams: () => ({ slug: 'team', problemSlug: 'sum' }),
  usePathname: () => nav.pathname,
}));
const problemsApi = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/features/problems/api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/problems/api/problems.api')>()),
  problemsApi,
}));
const submissionsApi = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), get: vi.fn() }));
vi.mock('../api/submissions.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/submissions.api')>()),
  submissionsApi,
}));

import type { SubmissionSummary } from '../api/submissions.api';
import { SolveView, fromSummary, submitErrorMessage } from './solve-view';

const summary = makeSummary();

beforeEach(() => {
  vi.clearAllMocks();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  problemsApi.get.mockResolvedValue(makeProblem());
  submissionsApi.list.mockResolvedValue({ items: [], page: 1, page_size: 1, total: 0 });
});
afterEach(() => vi.unstubAllGlobals());

const editorBox = () => screen.findByRole('textbox', { name: /source code/ }) as Promise<HTMLTextAreaElement>;

describe('the problem page (GRD-48)', () => {
  it('shows the statement with maths, the limits and a sample that can be copied', async () => {
    renderInApp(<SolveView />);
    expect(await screen.findByRole('heading', { name: 'Sum of two numbers' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Task' })).toBeTruthy();
    expect(document.querySelectorAll('.katex').length).toBeGreaterThan(0);
    expect(screen.getByText('Time limit').nextSibling?.textContent).toBe('1.00 s'.replace('1.00', '1'));
    expect(screen.getByText('Memory limit').nextSibling?.textContent).toBe('256 MB');
    expect(screen.getByLabelText('Sample', { selector: 'section' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy input' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy output' })).toBeTruthy();
  });

  it('offers only the languages the problem allows, starting from a template', async () => {
    problemsApi.get.mockResolvedValue(makeProblem({ allowed_languages: ['python', 'cpp'] }));
    renderInApp(<SolveView />);
    const select = await screen.findByRole('combobox', { name: 'Language' });
    expect(select.textContent).toBe('Python 3');
    await userEvent.click(select);
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Python 3', 'C++']);
    await userEvent.keyboard('{Escape}');
    expect((await editorBox()).value).toContain('import sys');
  });

  it('keeps unfinished code in this browser, per language, and brings it back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = renderInApp(<SolveView />);
    // C is the first allowed language
    fireEvent.change(await editorBox(), { target: { value: 'int main(void) { /* c draft */ }' } });
    await act(async () => vi.advanceTimersByTime(700));
    // another language has its own code
    await chooseOption('Language', LANGUAGE_LABELS.python);
    expect((await editorBox()).value).toContain('import sys');
    fireEvent.change(await editorBox(), { target: { value: 'print("py draft")' } });
    await act(async () => vi.advanceTimersByTime(700));
    await chooseOption('Language', LANGUAGE_LABELS.cpp);
    expect((await editorBox()).value).toContain('#include <iostream>');
    await chooseOption('Language', LANGUAGE_LABELS.c);
    expect((await editorBox()).value).toBe('int main(void) { /* c draft */ }');
    first.unmount();
    vi.useRealTimers();

    renderInApp(<SolveView />);
    // it comes back on the language it was last on, with its code
    expect((await editorBox()).value).toBe('int main(void) { /* c draft */ }');
    await chooseOption('Language', LANGUAGE_LABELS.python);
    expect((await editorBox()).value).toBe('print("py draft")');
  });

  it('submits the code in the chosen language and follows the result live', async () => {
    submissionsApi.create.mockResolvedValue({ ...summary, id: 's9' });
    renderInApp(<SolveView />);
    const box = await editorBox();
    fireEvent.change(box, { target: { value: 'int main(){return 0;}' } });
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(submissionsApi.create).toHaveBeenCalledWith(
        { slug: 'team', problemSlug: 'sum' },
        { language: 'c', source: 'int main(){return 0;}' }
      )
    );
    expect(await screen.findByText('Waiting for a judge')).toBeTruthy();
    await waitFor(() => expect(FakeEventSource.last.url).toBe('/api/v1/submissions/s9/events'));
    act(() => FakeEventSource.last.push(makeSubmission({ id: 's9', status: 'running' })));
    expect(await screen.findByText('Running your solution')).toBeTruthy();
    act(() =>
      FakeEventSource.last.push(
        makeSubmission({
          id: 's9',
          status: 'completed',
          verdict: 'AC',
          time_ms: 12,
          memory_kb: 2048,
          tests_passed: 2,
          results: [
            { position: 1, is_sample: true, verdict: 'AC', time_ms: 5, memory_kb: 1024 },
            { position: 2, is_sample: false, verdict: 'AC', time_ms: 12, memory_kb: 2048 },
          ],
        })
      )
    );
    expect((await screen.findAllByText('Accepted')).length).toBeGreaterThan(0);
    expect(screen.getByText('12 ms')).toBeTruthy();
    expect(screen.getByText('2.0 MB')).toBeTruthy();
    expect(screen.getAllByText('2 / 2').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Full result' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum/submissions/s9'
    );
  });

  it('submits with Ctrl+Enter from the editor', async () => {
    submissionsApi.create.mockResolvedValue(summary);
    renderInApp(<SolveView />);
    fireEvent.keyDown(await editorBox(), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(submissionsApi.create).toHaveBeenCalledTimes(1));
  });

  it('disables the button while submitting, so one click is one submission', async () => {
    let finish!: (value: unknown) => void;
    submissionsApi.create.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderInApp(<SolveView />);
    await editorBox();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const busy = await screen.findByRole('button', { name: 'Submitting…' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(busy);
    expect(submissionsApi.create).toHaveBeenCalledTimes(1);
    await act(async () => finish(summary));
  });

  it('stays clickable after an Accepted result, so the same code can be submitted again', async () => {
    submissionsApi.list.mockResolvedValue({
      items: [{ ...summary, id: 'old', status: 'completed', verdict: 'AC', tests_passed: 2 }],
      page: 1,
      page_size: 1,
      total: 1,
    });
    submissionsApi.get.mockResolvedValue(makeSubmission({ id: 'old', status: 'completed', verdict: 'AC' }));
    submissionsApi.create.mockResolvedValue({ ...summary, id: 'again' });
    renderInApp(<SolveView />);
    await screen.findAllByText('Accepted');
    const button = screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await userEvent.click(button);
    await waitFor(() => expect(submissionsApi.create).toHaveBeenCalledTimes(1));
  });

  it('is disabled only while the submission waits to be judged', async () => {
    submissionsApi.create.mockResolvedValue({ ...summary, id: 's9' });
    renderInApp(<SolveView />);
    await editorBox();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const waiting = await screen.findByRole('button', { name: 'Waiting for the result…' });
    expect((waiting as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(FakeEventSource.last.url).toBe('/api/v1/submissions/s9/events'));
    act(() =>
      FakeEventSource.last.push(makeSubmission({ id: 's9', status: 'completed', verdict: 'WA', tests_passed: 1 }))
    );
    const again = (await screen.findByRole('button', { name: 'Submit' })) as HTMLButtonElement;
    expect(again.disabled).toBe(false);
  });

  it('shows the latest submission of mine when the page opens', async () => {
    submissionsApi.list.mockResolvedValue({
      items: [{ ...summary, id: 'old', status: 'completed', verdict: 'WA', tests_passed: 1 }],
      page: 1,
      page_size: 1,
      total: 3,
    });
    submissionsApi.get.mockResolvedValue(makeSubmission({ id: 'old', status: 'completed', verdict: 'WA' }));
    renderInApp(<SolveView />);
    expect(await screen.findByText(/Wrong answer/)).toBeTruthy();
  });

  describe('result, testcases and earlier submissions (GRD-112, GRD-115)', () => {
    const runs = (verdicts: Array<[string, number]>) =>
      verdicts.map(([verdict, count]) => ({ verdict, count })) as SubmissionSummary['test_runs'];
    const best: SubmissionSummary = {
      ...summary,
      id: 'best',
      number: 2,
      status: 'completed',
      verdict: 'WA',
      tests_passed: 3,
      tests_total: 4,
      time_ms: 40,
      memory_kb: 2048,
      test_runs: runs([
        ['AC', 3],
        ['WA', 1],
      ]),
    };
    const newer: SubmissionSummary = {
      ...best,
      id: 'newer',
      number: 3,
      tests_passed: 1,
      test_runs: runs([
        ['AC', 1],
        ['WA', 3],
      ]),
    };
    const list = () =>
      submissionsApi.list.mockResolvedValue({ items: [newer, best], best, page: 1, page_size: 10, total: 3 });
    const openSubmissions = async () => {
      await userEvent.click(await screen.findByRole('tab', { name: /Submissions/ }));
      return screen.findByRole('region', { name: 'Best submission' });
    };

    it('keeps the result and every testcase of the latest submission on the page', async () => {
      list();
      const full = makeSubmission({
        id: 'newer',
        number: 3,
        status: 'completed',
        verdict: 'WA',
        tests_passed: 1,
        tests_total: 4,
        time_ms: 30,
        memory_kb: 2048,
        test_runs: newer.test_runs,
        results: [
          { position: 1, is_sample: true, verdict: 'AC', time_ms: 5, memory_kb: 1024, stdout_preview: '3\n' },
          { position: 2, is_sample: false, verdict: 'WA', time_ms: 6, memory_kb: 1024 },
          { position: 3, is_sample: false, verdict: 'WA', time_ms: 6, memory_kb: 1024 },
          { position: 4, is_sample: false, verdict: 'WA', time_ms: 6, memory_kb: 1024 },
        ],
      });
      renderInApp(<SolveView />);
      // The live stream opens on the latest submission and starts with its full result.
      await waitFor(() => expect(FakeEventSource.instances.length).toBeGreaterThan(0));
      act(() => FakeEventSource.last.push(full));
      const result = await screen.findByRole('region', { name: 'Result' });
      expect(within(result).getByText(/Submission #3/)).toBeTruthy();
      // One button per testcase, the first failing one chosen, a hidden one explained.
      const grid = await within(result).findByRole('button', { name: /Testcase 2: Wrong answer/ });
      expect(grid.getAttribute('aria-pressed')).toBe('true');
      expect(within(result).getAllByRole('button', { name: /^Testcase \d/ })).toHaveLength(4);
      expect(within(result).getByText(/Hidden testcase/)).toBeTruthy();
      // The filter keeps only what did not pass; a passed example opens beside its expected output.
      await userEvent.click(within(result).getByRole('button', { name: 'Not passed 3' }));
      expect(within(result).getAllByRole('button', { name: /^Testcase \d/ })).toHaveLength(3);
      await userEvent.click(within(result).getByRole('button', { name: 'All 4' }));
      await userEvent.click(within(result).getByRole('button', { name: /Testcase 1: Accepted/ }));
      expect(within(result).getByText(/Expected output/)).toBeTruthy();
    });

    it('pins the best submission above the list, which still holds it', async () => {
      list();
      renderInApp(<SolveView />);
      const bestRegion = await openSubmissions();
      expect(within(bestRegion).getByText('Best submission')).toBeTruthy();
      expect(within(bestRegion).getByText(/#2/)).toBeTruthy();
      expect(within(bestRegion).getByText('3 / 4')).toBeTruthy();
      const all = screen.getByRole('region', { name: 'All submissions' });
      expect(within(all).getByText('3 total')).toBeTruthy();
      expect(within(all).getAllByRole('button', { expanded: false })).toHaveLength(2);
      expect(screen.getByRole('tab', { name: /Submissions/ }).textContent).toMatch(/3/);
    });

    it('opens a row to show its tests and its code', async () => {
      list();
      submissionsApi.get.mockResolvedValue(makeSubmission({ id: 'newer', source: 'print(1)' }));
      renderInApp(<SolveView />);
      await openSubmissions();
      const all = screen.getByRole('region', { name: 'All submissions' });
      await userEvent.click(within(all).getAllByRole('button', { expanded: false })[0]!);
      expect(await within(all).findByLabelText('Code of submission #3')).toBeTruthy();
      expect(within(all).getByRole('progressbar')).toBeTruthy();
    });

    it('replaces the code from a submission, shows where it came from, and undoes it', async () => {
      list();
      submissionsApi.get.mockResolvedValue(
        makeSubmission({ id: 'best', number: 2, language: 'c', source: 'int old;' })
      );
      renderInApp(<SolveView />);
      fireEvent.change(await editorBox(), { target: { value: 'my own code' } });
      const bestRegion = await openSubmissions();
      await userEvent.click(within(bestRegion).getByRole('button', { name: 'Replace code' }));
      // Back on the Code tab, loaded, not submitted, and nothing was sent.
      await waitFor(async () => expect((await editorBox()).value).toBe('int old;'));
      expect(screen.getByText('Loaded from submission #2')).toBeTruthy();
      expect(submissionsApi.create).not.toHaveBeenCalled();
      expect(screen.getByText('Code replaced with submission #2')).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
      await waitFor(async () => expect((await editorBox()).value).toBe('my own code'));
      expect(screen.queryByText('Loaded from submission #2')).toBeNull();
    });

    it('does not offer Replace for a language the problem no longer accepts', async () => {
      list();
      problemsApi.get.mockResolvedValue(makeProblem({ allowed_languages: ['python'] }));
      renderInApp(<SolveView />);
      const bestRegion = await openSubmissions();
      expect((within(bestRegion).getByRole('button', { name: 'Replace code' }) as HTMLButtonElement).disabled).toBe(
        true
      );
    });

    it('lists more of them on request', async () => {
      const many = Array.from({ length: 10 }, (_, index) => ({ ...newer, id: `n${index}`, number: 12 - index }));
      submissionsApi.list.mockImplementation(async (_target, query: { page: number }) =>
        query.page === 1
          ? { items: many, best: null, page: 1, page_size: 10, total: 12 }
          : {
              items: [
                { ...newer, id: 'older', number: 2 },
                { ...newer, id: 'oldest', number: 1 },
              ],
              best: null,
              page: 2,
              page_size: 10,
              total: 12,
            }
      );
      renderInApp(<SolveView />);
      await userEvent.click(await screen.findByRole('tab', { name: /Submissions/ }));
      await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull());
      expect(within(screen.getByRole('region', { name: 'All submissions' })).getAllByRole('listitem')).toHaveLength(12);
    });

    it('says so when there are no submissions yet', async () => {
      renderInApp(<SolveView />);
      await userEvent.click(await screen.findByRole('tab', { name: /Submissions/ }));
      expect(await screen.findByText('No submissions yet')).toBeTruthy();
    });
  });

  describe('when Core refuses', () => {
    async function submitAndFail(error: unknown) {
      submissionsApi.create.mockRejectedValue(error);
      renderInApp(<SolveView />);
      const box = await editorBox();
      fireEvent.change(box, { target: { value: 'my code' } });
      await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
      return screen.findByRole('alert');
    }

    it('says so plainly when the rate limit is hit, and keeps the code', async () => {
      const alert = await submitAndFail(
        new ApiError(429, 'RATE_LIMITED', 'Too many submissions. Try again in 42 seconds.')
      );
      expect(alert.textContent).toBe('You can submit at most 10 times a minute. Try again in 42 seconds.');
      expect(((await editorBox()) as HTMLTextAreaElement).value).toBe('my code');
      expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('says when the problem is not open for submissions', async () => {
      const alert = await submitAndFail(
        new ApiError(409, 'PROBLEM_NOT_OPEN', 'This problem is archived and no longer accepts submissions.')
      );
      expect(alert.textContent).toBe('This problem is archived and no longer accepts submissions.');
    });

    it('shows the field message for a bad language or source', async () => {
      const alert = await submitAndFail(
        new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
          { field: 'source', message: 'Use at most 64 KiB.' },
        ])
      );
      expect(alert.textContent).toBe('Use at most 64 KiB.');
    });

    it('sends a signed-out session to the login page', async () => {
      await submitAndFail(new ApiError(401, 'UNAUTHORIZED', 'Please log in.')).catch(() => undefined);
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/login?next=%2Fspaces%2Fteam%2Fproblems%2Fsum'));
    });

    it('tells a network failure in words', async () => {
      const alert = await submitAndFail(
        new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.')
      );
      expect(alert.textContent).toMatch(/Could not reach the server/);
    });
  });

  it('asks a visitor to log in instead of submitting, and keeps their code', async () => {
    renderInApp(<SolveView />, { auth: ANONYMOUS });
    const box = await editorBox();
    fireEvent.change(box, { target: { value: 'visitor code' } });
    await userEvent.click(screen.getByRole('button', { name: 'Log in to submit' }));
    expect(nav.push).toHaveBeenCalledWith('/login?next=%2Fspaces%2Fteam%2Fproblems%2Fsum');
    expect(submissionsApi.create).not.toHaveBeenCalled();
    expect(screen.getByText(/Log in to submit a solution/)).toBeTruthy();
    expect(submissionsApi.list).not.toHaveBeenCalled();
  });

  it('closes submissions for an archived problem and explains', async () => {
    problemsApi.get.mockResolvedValue(makeProblem({ status: 'archived', accepts_submissions: false }));
    renderInApp(<SolveView />);
    expect(await screen.findByText(/archived\. You can read it/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Submissions are closed.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This problem is archived and no longer accepts submissions.'
    );
    expect(submissionsApi.create).not.toHaveBeenCalled();
  });

  it('closes submissions in an archived Space', async () => {
    problemsApi.get.mockResolvedValue(makeProblem({ accepts_submissions: false }));
    renderInApp(<SolveView />, { space: makeSpace('solver', { archived_at: '2026-10-11T00:00:00Z' }) });
    expect(await screen.findByText(/This Space is archived, so nothing can be submitted/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This Space is archived, so nothing can be submitted.');
    expect(submissionsApi.create).not.toHaveBeenCalled();
  });

  it('shows an author a draft as a preview that cannot be submitted', async () => {
    problemsApi.get.mockResolvedValue(makeProblem({ status: 'draft', accepts_submissions: false, published_at: null }));
    renderInApp(<SolveView />, { space: makeSpace('editor') });
    expect(await screen.findByText(/preview of a draft/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit problem' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum/edit'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/This problem is a draft/);
    expect(submissionsApi.create).not.toHaveBeenCalled();
  });

  it('shows the edit link to authors only', async () => {
    renderInApp(<SolveView />, { space: makeSpace('solver') });
    await screen.findByRole('heading', { name: 'Sum of two numbers' });
    expect(screen.queryByRole('link', { name: 'Edit problem' })).toBeNull();
    // Their submissions live in the Submissions tab of this page, not behind a link.
    expect(screen.queryByRole('link', { name: 'Your submissions' })).toBeNull();
  });

  it('shows a clear message when the problem does not exist, and a retry when loading fails', async () => {
    problemsApi.get.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Problem not found.'));
    const first = renderInApp(<SolveView />);
    expect(await screen.findByText('Problem not found')).toBeTruthy();
    first.unmount();
    problemsApi.get.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'The service is temporarily unavailable.'));
    renderInApp(<SolveView />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('The service is temporarily unavailable.')).toBeTruthy();
    problemsApi.get.mockResolvedValue(makeProblem());
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Sum of two numbers' })).toBeTruthy();
  });

  describe('a problem outside every Track the person can see (GRD-81, GRD-84)', () => {
    const notFound = () => problemsApi.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Problem not found.'));

    it('looks the same as a missing problem to someone who never submitted to it', async () => {
      notFound();
      renderInApp(<SolveView />);
      expect(await screen.findByText('Problem not found')).toBeTruthy();
      expect(screen.getByText(/may not be in a Track you can see/)).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
    });

    it('still shows the history of someone who submitted before it was taken out, with new submissions closed', async () => {
      notFound();
      submissionsApi.list.mockResolvedValue({
        items: [makeSummary({ id: 's9', status: 'completed', verdict: 'AC' })],
        page: 1,
        page_size: 20,
        total: 1,
      });
      renderInApp(<SolveView />);
      expect(await screen.findByText(/no longer in any Track you can see/)).toBeTruthy();
      const table = screen.getByRole('table', { name: 'Submissions' });
      expect(within(table).getByText('Accepted')).toBeTruthy();
      expect(within(table).getByRole('link', { name: 'Sum of two numbers' }).getAttribute('href')).toBe(
        '/spaces/team/problems/sum/submissions/s9'
      );
      // nothing to submit to: no Submit button (it would be disabled for a reason GRD-99 does not allow)
      expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
      expect(screen.queryByRole('textbox', { name: /source code/ })).toBeNull();
    });

    it('does not even look for a history when the person is not logged in', async () => {
      notFound();
      renderInApp(<SolveView />, { auth: ANONYMOUS });
      expect(await screen.findByText('Problem not found')).toBeTruthy();
      expect(submissionsApi.list).not.toHaveBeenCalled();
    });
  });

  it('on a small screen it says writing code is easier on a larger one, and still works', async () => {
    renderInApp(<SolveView />);
    await editorBox();
    expect(screen.getByText(/easier on a larger screen/)).toBeTruthy();
  });
});

describe('helpers', () => {
  it('fromSummary fills what a summary lacks', () => {
    expect(fromSummary(summary)).toMatchObject({ id: 's1', results: [], compile_message: null, can_rejudge: false });
  });

  it.each([
    [
      new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again in 7 seconds.'),
      'You can submit at most 10 times a minute. Try again in 7 seconds.',
    ],
    [
      new ApiError(429, 'RATE_LIMITED', 'Slow down.'),
      'You can submit at most 10 times a minute. Wait a moment and try again.',
    ],
    [new ApiError(409, 'PROBLEM_NOT_OPEN', 'Closed.'), 'Closed.'],
    [new ApiError(403, 'FORBIDDEN', 'Archived Space.'), 'Archived Space.'],
    [
      new ApiError(400, 'VALIDATION_FAILED', 'Bad.', [{ field: 'language', message: 'This problem accepts: c.' }]),
      'This problem accepts: c.',
    ],
    [new Error('boom'), 'boom'],
  ])('submitErrorMessage(%s)', (error, text) => {
    expect(submitErrorMessage(error)).toBe(text);
  });
});
