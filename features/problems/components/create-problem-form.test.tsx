import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeSpace, renderInApp } from '@/features/test-support';

const nav = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, back: nav.back, replace: vi.fn() }),
  usePathname: () => '/spaces/team/problems/new',
}));
const api = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { CreateProblemForm } from './create-problem-form';
import { suggestProblemSlug } from '../slug';

beforeEach(() => vi.clearAllMocks());

describe('starting a problem', () => {
  it('suggests a slug from the title until the person edits it', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    const title = screen.getByLabelText('Title');
    await userEvent.type(title, 'A + B (easy)');
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('a-b-easy');
    await userEvent.clear(screen.getByLabelText('Slug'));
    await userEvent.type(screen.getByLabelText('Slug'), 'my-own');
    await userEvent.type(title, ' more');
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('my-own');
  });

  it('creates the draft and opens the editor', async () => {
    api.create.mockResolvedValue({ slug: 'sum' });
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('team', { slug: 'sum', title: 'Sum', statement: '' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/spaces/team/problems/sum/edit'));
  });

  it('keeps the button off until there is a title and a slug', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('owner') });
    expect((screen.getByRole('button', { name: 'Create draft' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a taken or reserved slug next to the slug field', async () => {
    api.create.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'A problem with this slug already exists in this Space.')
    );
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByText('A problem with this slug already exists in this Space.')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();

    api.create.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'slug', message: 'This slug is reserved. Pick another.' },
      ])
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByText('This slug is reserved. Pick another.')).toBeTruthy();
  });

  it('does not offer the form to someone who cannot add problems', () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('solver') });
    expect(screen.getByText('You cannot add problems here')).toBeTruthy();
    expect(screen.getByText(/Only owners and editors/)).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('says an archived Space is read-only', () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    expect(screen.getByText(/This Space is archived/)).toBeTruthy();
  });
});

describe('suggestProblemSlug', () => {
  it.each([
    ['Two Sum', 'two-sum'],
    ['  A + B  ', 'a-b'],
    ['Café Ünïcode', 'cafe-unicode'],
    ['ข้อ 1', '1'],
    ['日本語', ''],
    ['x'.repeat(80), 'x'.repeat(64)],
    ['ends with dash -----', 'ends-with-dash'],
  ])('%j -> %j', (title, slug) => {
    expect(suggestProblemSlug(title)).toBe(slug);
  });
});
