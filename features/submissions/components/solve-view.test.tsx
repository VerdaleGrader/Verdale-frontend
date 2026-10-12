import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  ANONYMOUS,
  FakeEventSource,
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
    const select = (await screen.findByRole('combobox', { name: 'Language' })) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['python', 'cpp']);
    expect(select.value).toBe('python');
    expect((await editorBox()).value).toContain('import sys');
  });

  it('keeps unfinished code in this browser, per language, and brings it back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = renderInApp(<SolveView />);
    // C is the first allowed language
    fireEvent.change(await editorBox(), { target: { value: 'int main(void) { /* c draft */ }' } });
    await act(async () => vi.advanceTimersByTime(700));
    // another language has its own code
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'python' } });
    expect((await editorBox()).value).toContain('import sys');
    fireEvent.change(await editorBox(), { target: { value: 'print("py draft")' } });
    await act(async () => vi.advanceTimersByTime(700));
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'cpp' } });
    expect((await editorBox()).value).toContain('#include <iostream>');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'c' } });
    expect((await editorBox()).value).toBe('int main(void) { /* c draft */ }');
    first.unmount();
    vi.useRealTimers();

    renderInApp(<SolveView />);
    // it comes back on the language it was last on, with its code
    expect((await editorBox()).value).toBe('int main(void) { /* c draft */ }');
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'python' } });
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
    expect(screen.getByText('2 of 2')).toBeTruthy();
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
      expect(alert.textContent).toBe('You are submitting too quickly. Too many submissions. Try again in 42 seconds.');
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
    expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Submissions are closed.')).toBeTruthy();
  });

  it('closes submissions in an archived Space', async () => {
    problemsApi.get.mockResolvedValue(makeProblem({ accepts_submissions: false }));
    renderInApp(<SolveView />, { space: makeSpace('solver', { archived_at: '2026-10-11T00:00:00Z' }) });
    expect(await screen.findByText(/This Space is archived, so nothing can be submitted/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an author a draft as a preview that cannot be submitted', async () => {
    problemsApi.get.mockResolvedValue(makeProblem({ status: 'draft', accepts_submissions: false, published_at: null }));
    renderInApp(<SolveView />, { space: makeSpace('editor') });
    expect(await screen.findByText(/preview of a draft/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit problem' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum/edit'
    );
    expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the edit link to authors only', async () => {
    renderInApp(<SolveView />, { space: makeSpace('solver') });
    await screen.findByRole('heading', { name: 'Sum of two numbers' });
    expect(screen.queryByRole('link', { name: 'Edit problem' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Your submissions' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum/submissions'
    );
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
    [new ApiError(429, 'RATE_LIMITED', 'Try later.'), 'You are submitting too quickly. Try later.'],
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
