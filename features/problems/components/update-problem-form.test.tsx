import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, makeProblem, makeSpace, renderInApp } from '@/features/test-support';
import type { ProblemEditor } from '../types';
import { WorkspaceContext } from './problem-workspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const api = vi.hoisted(() => ({ updatePublished: vi.fn(), editor: vi.fn(), get: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { UpdateProblemForm } from './update-problem-form';

const published = (overrides: Partial<ProblemEditor['version']> = {}): ProblemEditor => {
  const base = makeEditor();
  const version = {
    ...base.version,
    status: 'published' as const,
    major: 2,
    minor: 1,
    label: 'v2.1',
    published_at: '2026-10-11T00:00:00Z',
    ...overrides,
  };
  return { ...base, status: 'published', editable: false, version, open_version: version };
};

function Harness({ initial }: { initial: ProblemEditor }) {
  const [editor, setEditor] = useState(initial);
  return (
    <WorkspaceContext.Provider
      value={{ target: { slug: 'team', problemSlug: 'sum' }, editor, setEditor, refresh: async () => undefined }}
    >
      <UpdateProblemForm />
    </WorkspaceContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(makeProblem());
});

describe('the update form of a published problem', () => {
  it('predicts Minor for a title change and sends expected_version, then toasts the new number', async () => {
    const initial = published();
    api.updatePublished.mockResolvedValue({
      kind: 'minor',
      forced: false,
      major_fields: [],
      label: 'v2.2',
      editor: published({ minor: 2, label: 'v2.2', title: 'Sum' }),
    });
    renderInApp(<Harness initial={initial} />, { space: makeSpace('editor') });
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Sum' } });
    expect(screen.getByText('Minor update (expected)')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save as Minor update' }));
    await waitFor(() =>
      expect(api.updatePublished).toHaveBeenCalledWith(
        { slug: 'team', problemSlug: 'sum' },
        { expected_version: { major: 2, minor: 1 }, force_major: false, title: 'Sum' }
      )
    );
    expect(await screen.findByText('Minor update, now v2.2')).toBeTruthy();
  });

  it('predicts Major from a limit and locks Force major as already major', async () => {
    renderInApp(<Harness initial={published()} />, { space: makeSpace('editor') });
    fireEvent.change(await screen.findByLabelText('Time limit (ms)'), { target: { value: '2000' } });
    expect(screen.getByText('Major update (expected)')).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: /Force major update/ });
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect((box as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Save as Major draft' })).toBeTruthy();
  });

  it('keeps typed work on a version conflict, reloads and lists what changed meanwhile', async () => {
    api.updatePublished.mockRejectedValue(
      new ApiError(409, 'VERSION_CONFLICT', 'The problem changed.', [{ field: 'label', message: 'v2.2' }])
    );
    api.editor.mockResolvedValue(published({ minor: 2, label: 'v2.2', title: 'Other title' }));
    renderInApp(<Harness initial={published()} />, { space: makeSpace('editor') });
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'My title' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save as Minor update' }));
    expect(await screen.findByText('Someone changed this problem. It is now v2.2.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByText(/the open version is now v2\.2/)).toBeTruthy();
    expect(screen.getByText(/You also edited Title/)).toBeTruthy();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('My title');
  });

  it('is read-only for an observer', async () => {
    renderInApp(<Harness initial={published()} />, { space: makeSpace('observer') });
    expect(((await screen.findByLabelText('Title')) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('checkbox', { name: /Force major update/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save as/ })).toBeNull();
  });
});
