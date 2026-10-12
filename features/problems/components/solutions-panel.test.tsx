import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, renderInApp } from '@/features/test-support';
import type { ReferenceSolution } from '../types';
import { WorkspaceContext } from './problem-workspace';

const api = vi.hoisted(() => ({
  solutions: vi.fn(),
  addSolution: vi.fn(),
  updateSolution: vi.fn(),
  removeSolution: vi.fn(),
}));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { SolutionsPanel } from './solutions-panel';

const solution = (id: string, overrides: Partial<ReferenceSolution> = {}): ReferenceSolution => ({
  id,
  language: 'cpp',
  source: 'int main(){}',
  source_bytes: 12,
  is_primary: false,
  created_by: { username: 'edith', display_name: 'Edith', avatar_url: null },
  created_at: '2026-10-11T00:00:00Z',
  updated_at: '2026-10-11T00:00:00Z',
  ...overrides,
});
const refresh = vi.fn().mockResolvedValue(undefined);
function renderPanel(items: ReferenceSolution[], editable = true) {
  api.solutions.mockResolvedValue(items);
  return renderInApp(
    <WorkspaceContext.Provider
      value={{
        target: { slug: 'team', problemSlug: 'sum' },
        editor: makeEditor({ editable }),
        setEditor: vi.fn(),
        refresh,
      }}
    >
      <SolutionsPanel />
    </WorkspaceContext.Provider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('reference solutions', () => {
  it('says who can see them and lists them, primary marked', async () => {
    renderPanel([solution('a', { is_primary: true }), solution('b', { language: 'python', source_bytes: 2048 })]);
    expect(await screen.findByText(/Only owners and editors of this Space can see it/)).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]!).getByText('C++')).toBeTruthy();
    expect(within(items[0]!).getByText('Primary')).toBeTruthy();
    expect(within(items[1]!).getByText('Python 3')).toBeTruthy();
    expect(within(items[1]!).getByText('2 KiB')).toBeTruthy();
    expect(within(items[1]!).queryByText('Primary')).toBeNull();
  });

  it('explains the empty state', async () => {
    renderPanel([]);
    expect(await screen.findByText('No reference solution yet')).toBeTruthy();
  });

  it('adds a solution in the chosen language; the first one is offered as primary', async () => {
    api.addSolution.mockResolvedValue(solution('new', { is_primary: true }));
    renderPanel([]);
    const form = (await screen.findByRole('heading', { name: 'Add a reference solution' })).closest('form')!;
    expect(within(form).getByLabelText('Make this the primary solution')).toHaveProperty('checked', true);
    await userEvent.selectOptions(within(form).getByLabelText('Language'), 'python');
    fireEvent.change(within(form).getByLabelText('Reference solution source code'), { target: { value: 'print(3)' } });
    await userEvent.click(within(form).getByRole('button', { name: 'Add solution' }));
    await waitFor(() =>
      expect(api.addSolution).toHaveBeenCalledWith(
        { slug: 'team', problemSlug: 'sum' },
        { language: 'python', source: 'print(3)', is_primary: true }
      )
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('offers nothing to add until there is code', async () => {
    renderPanel([solution('a', { is_primary: true })]);
    const form = (await screen.findByRole('heading', { name: 'Add a reference solution' })).closest('form')!;
    expect(within(form).getByLabelText('Make this the primary solution')).toHaveProperty('checked', false);
    expect((within(form).getByRole('button', { name: 'Add solution' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows Core’s message next to the form when it refuses', async () => {
    api.addSolution.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'source', message: 'Use at most 64 KiB.' },
      ])
    );
    renderPanel([]);
    const form = (await screen.findByRole('heading', { name: 'Add a reference solution' })).closest('form')!;
    fireEvent.change(within(form).getByLabelText('Reference solution source code'), { target: { value: 'x' } });
    await userEvent.click(within(form).getByRole('button', { name: 'Add solution' }));
    expect((await within(form).findByRole('alert')).textContent).toBe('Use at most 64 KiB.');
  });

  it('makes another solution primary', async () => {
    api.updateSolution.mockResolvedValue(solution('b', { is_primary: true }));
    renderPanel([solution('a', { is_primary: true }), solution('b')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Make primary' }));
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, 'b', { is_primary: true })
    );
  });

  it('edits the source in a dialog', async () => {
    api.updateSolution.mockResolvedValue(solution('a'));
    renderPanel([solution('a', { is_primary: true })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit the C++ solution' }));
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByLabelText('Reference solution source code') as HTMLTextAreaElement;
    expect(box.value).toBe('int main(){}');
    fireEvent.change(box, { target: { value: 'int main(){return 0;}' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save solution' }));
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(expect.anything(), 'a', {
        language: 'cpp',
        source: 'int main(){return 0;}',
      })
    );
  });

  it('warns that deleting the primary solution blocks publishing, and deletes after confirming', async () => {
    api.removeSolution.mockResolvedValue(undefined);
    renderPanel([solution('a', { is_primary: true })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete the C++ solution' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/cannot be published until you choose another primary/)).toBeTruthy();
    expect(api.removeSolution).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete solution' }));
    await waitFor(() => expect(api.removeSolution).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, 'a'));
  });

  it('is read-only once published: no form, no buttons', async () => {
    renderPanel([solution('a', { is_primary: true })], false);
    await screen.findByText('Primary');
    expect(screen.queryByRole('heading', { name: 'Add a reference solution' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit the/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete the/ })).toBeNull();
  });
});
