import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { renderInApp } from '@/features/test-support';
import type { AiTestJob } from '../types';

const api = vi.hoisted(() => ({
  aiCredentials: vi.fn(),
  saveAiCredential: vi.fn(),
  deleteAiCredential: vi.fn(),
  startAiTests: vi.fn(),
  aiTestJob: vi.fn(),
  solutions: vi.fn(),
  stageFile: vi.fn(),
}));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { AiTestcaseDialog } from './ai-testcase-dialog';

const TARGET = { slug: 'team', problemSlug: 'sum' };
const SOLUTION = {
  id: 'sol1',
  language: 'cpp',
  source: 'x',
  source_bytes: 1200,
  is_primary: true,
  created_by: { username: 'e', display_name: 'E', avatar_url: null },
  created_at: '2026-10-10T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
};
const NO_KEYS = { enabled: true, items: [] };
const CLAUDE_KEY = { enabled: true, items: [{ provider: 'claude', last4: 'WXYZ' }] };

const job = (overrides: Partial<AiTestJob> = {}): AiTestJob => ({
  id: 'job1',
  status: 'generating',
  provider: 'claude',
  requested_count: 2,
  error: null,
  created_at: '2026-10-15T00:00:00Z',
  deadline_at: '2026-10-15T00:05:00Z',
  finished_at: null,
  usable_count: 0,
  skipped_count: 0,
  items: [],
  ...overrides,
});
const okItem = (position: number) => ({
  id: `item-${position}`,
  position,
  status: 'ok' as const,
  input: { sha256: `${position}`.repeat(64), size_bytes: 4 },
  input_text: `${position} ${position}\n`,
  output: { sha256: `${position + 5}`.repeat(64), size_bytes: 2 },
  output_preview: `${position * 2}\n`,
  skip_reason: null,
});
const completed = (items: AiTestJob['items']) =>
  job({
    status: 'completed',
    items,
    usable_count: items.filter((entry) => entry.status === 'ok').length,
    skipped_count: items.filter((entry) => entry.status === 'skipped').length,
  });

const onClose = vi.fn();
const onAdd = vi.fn();
function renderDialog(room = 50) {
  let next = 0;
  return renderInApp(
    <AiTestcaseDialog
      open
      target={TARGET}
      baseHref="/spaces/team/problems/sum/edit"
      room={room}
      makeKey={() => `new-${next++}`}
      onClose={onClose}
      onAdd={onAdd}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  api.aiCredentials.mockResolvedValue(CLAUDE_KEY);
  api.solutions.mockResolvedValue([SOLUTION]);
});
afterEach(() => vi.useRealTimers());

describe('Generate with AI: setup', () => {
  it('shows a saved key only as its last four characters and offers to change or remove it', async () => {
    renderDialog();
    expect(await screen.findByText('WXYZ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change key' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove key' })).toBeTruthy();
    expect(screen.queryByLabelText('Claude API key')).toBeNull();
  });

  it('asks for a key when the provider has none, and generating waits until one is saved', async () => {
    api.aiCredentials.mockResolvedValue(NO_KEYS);
    api.saveAiCredential.mockResolvedValue({ provider: 'gemini', last4: '1234' });
    renderDialog();
    const field = await screen.findByLabelText('Gemini API key');
    expect(field).toHaveProperty('type', 'password');
    expect(screen.getByRole('button', { name: 'Generate testcases' })).toHaveProperty('disabled', true);

    api.aiCredentials.mockResolvedValue({ enabled: true, items: [{ provider: 'gemini', last4: '1234' }] });
    await userEvent.type(field, 'AIza-secret-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Save key' }));
    expect(api.saveAiCredential).toHaveBeenCalledWith('gemini', 'AIza-secret-1234');
    expect(await screen.findByText('1234')).toBeTruthy();
    expect(screen.queryByDisplayValue('AIza-secret-1234')).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate testcases' })).toHaveProperty('disabled', false)
    );
  });

  it('removes a key only after a confirmation that names the consequence', async () => {
    api.deleteAiCredential.mockResolvedValue(undefined);
    renderDialog();
    await screen.findByText('WXYZ');
    await userEvent.click(screen.getByRole('button', { name: 'Remove key' }));
    const confirm = await screen.findByRole('dialog', { name: /Remove your Claude key/ });
    expect(within(confirm).getByText(/enter a key again/)).toBeTruthy();
    api.aiCredentials.mockResolvedValue(NO_KEYS);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove key' }));
    expect(api.deleteAiCredential).toHaveBeenCalledWith('claude');
    expect(await screen.findByLabelText('Claude API key')).toBeTruthy();
  });

  it('needs a number of testcases between 1 and 20', async () => {
    renderDialog();
    await screen.findByText('WXYZ');
    const count = screen.getByLabelText('Number of testcases');
    await userEvent.clear(count);
    expect(await screen.findByText(/whole number/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate testcases' })).toHaveProperty('disabled', true);
    await userEvent.type(count, '21');
    expect(screen.getByText(/from 1 to 20/)).toBeTruthy();
  });

  it('warns before the solution’s code is sent, and sends only the statement by default', async () => {
    api.startAiTests.mockResolvedValue(job());
    renderDialog();
    await screen.findByText('WXYZ');
    expect(screen.queryByText(/goes to Anthropic/)).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: /send the solution’s code/ }));
    expect(screen.getByText(/The code goes to Anthropic/)).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: /send the solution’s code/ }));
    expect(screen.queryByText(/goes to Anthropic/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
    await waitFor(() => expect(api.startAiTests).toHaveBeenCalled());
    expect(api.startAiTests).toHaveBeenCalledWith(TARGET, {
      provider: 'claude',
      count: 5,
      categories: undefined,
      solution_id: 'sol1',
      include_solution: false,
    });
  });

  it('sends the additional note, trimmed, and nothing when it is empty', async () => {
    api.startAiTests.mockResolvedValue(job());
    renderDialog();
    await screen.findByText('WXYZ');
    await userEvent.type(screen.getByLabelText(/Additional note to the AI/), '  Keep n small.  ');
    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
    await waitFor(() => expect(api.startAiTests).toHaveBeenCalled());
    expect(api.startAiTests.mock.calls[0]![1]).toMatchObject({ note: 'Keep n small.' });
  });

  it('does not send a note that is only spaces', async () => {
    api.startAiTests.mockResolvedValue(job());
    renderDialog();
    await screen.findByText('WXYZ');
    await userEvent.type(screen.getByLabelText(/Additional note to the AI/), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
    await waitFor(() => expect(api.startAiTests).toHaveBeenCalled());
    expect(api.startAiTests.mock.calls[0]![1].note).toBeUndefined();
  });

  it('sends the categories the person ticked', async () => {
    api.startAiTests.mockResolvedValue(job());
    renderDialog();
    await screen.findByText('WXYZ');
    await userEvent.click(screen.getByRole('checkbox', { name: /Edge cases/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Largest values/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
    await waitFor(() => expect(api.startAiTests).toHaveBeenCalled());
    expect(api.startAiTests.mock.calls[0]![1]).toMatchObject({ categories: ['edge', 'max'] });
  });

  it('says so when the server has not set the feature up', async () => {
    api.aiCredentials.mockResolvedValue({ enabled: false, items: [] });
    renderDialog();
    expect(await screen.findByText(/not set up on this server/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generate testcases' })).toHaveProperty('disabled', true);
  });

  it('shows why a start was refused', async () => {
    api.startAiTests.mockRejectedValue(new ApiError(409, 'AI_TEST_RUNNING', 'Testcases are already being drafted.'));
    renderDialog();
    await screen.findByText('WXYZ');
    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already being drafted/);
  });
});

describe('Generate with AI: progress, failure and review', () => {
  async function startAndPoll(final: AiTestJob) {
    api.startAiTests.mockResolvedValue(job());
    api.aiTestJob.mockResolvedValue(final);
    renderDialog();
    await screen.findByText('WXYZ');
    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
  }

  it('reports the phase while it runs, then shows the drafts', async () => {
    await startAndPoll(completed([okItem(0), okItem(1)]));
    expect(await screen.findByText(/Generating inputs with Claude/)).toBeTruthy();
    expect(await screen.findByText('Review the drafts', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/2 of 2 drafts are ready/)).toBeTruthy();
  });

  it('explains a failure with the next step and offers another try', async () => {
    await startAndPoll(
      job({
        status: 'failed',
        error: { code: 'AI_KEY_INVALID', message: 'The provider did not accept your API key.' },
      })
    );
    expect(await screen.findByText('The provider did not accept your API key.', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/save it again, then try again/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Generate testcases' })).toBeTruthy();
  });

  it('lists skipped drafts with their reason and counts the usable ones', async () => {
    await startAndPoll(
      completed([
        okItem(0),
        {
          ...okItem(1),
          status: 'skipped',
          input: null,
          input_text: null,
          output: null,
          output_preview: null,
          skip_reason: 'Time limit exceeded on this input.',
        },
      ])
    );
    expect(await screen.findByText(/1 of 2 drafts are ready, 1 skipped/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('Time limit exceeded on this input.')).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
  });

  it('adds only the ticked drafts, unsaved, and never before the person confirms', async () => {
    await startAndPoll(completed([okItem(0), okItem(1)]));
    await screen.findByText('Review the drafts', {}, { timeout: 4000 });
    expect(onAdd).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox', { name: /Draft 2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 testcase' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    const added = onAdd.mock.calls[0]![0];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ key: 'new-0', baseline: null, output: { origin: 'generated' } });
    expect(onClose).toHaveBeenCalled();
  });

  it('stages an edited input and drops its expected output', async () => {
    api.stageFile.mockResolvedValue({ sha256: 'e'.repeat(64), size_bytes: 4, total_lines: 1 });
    await startAndPoll(completed([okItem(0)]));
    await screen.findByText('Review the drafts', {}, { timeout: 4000 });
    await userEvent.click(screen.getByRole('button', { name: 'Edit input' }));
    const area = screen.getByLabelText('Input of Draft 1');
    await userEvent.clear(area);
    await userEvent.type(area, '7 8');
    expect(screen.getByText(/Edited\. Its expected output is made again/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 testcase' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(api.stageFile).toHaveBeenCalledWith(TARGET, { text: '7 8' });
    expect(onAdd.mock.calls[0]![0][0]).toMatchObject({ output: null, input: { sha256: 'e'.repeat(64) } });
  });

  it('refuses to add more than the problem can hold', async () => {
    api.startAiTests.mockResolvedValue(job());
    api.aiTestJob.mockResolvedValue(completed([okItem(0), okItem(1)]));
    renderDialog(1);
    await screen.findByText('WXYZ');
    await userEvent.click(screen.getByRole('button', { name: 'Generate testcases' }));
    await screen.findByText('Review the drafts', {}, { timeout: 4000 });
    expect(screen.getByText(/Only 1 more testcase fits/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add 2 testcases' })).toHaveProperty('disabled', true);
  });

  it('picks up a running job after the dialog is opened again', async () => {
    window.sessionStorage.setItem('verdale-ai-tests-team-sum', 'job1');
    api.aiTestJob.mockResolvedValue(job({ status: 'computing' }));
    renderDialog();
    expect((await screen.findAllByText(/Computing expected outputs/)).length).toBeGreaterThan(0);
    expect(api.aiTestJob).toHaveBeenCalledWith(TARGET, 'job1');
  });
});
