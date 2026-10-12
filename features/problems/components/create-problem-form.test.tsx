import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { CONSTRAINTS, makeSpace, renderInApp } from '@/features/test-support';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, back: nav.back, replace: nav.replace }),
  usePathname: () => '/spaces/team/problems/new',
}));
const api = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), constraints: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { CreateProblemForm } from './create-problem-form';
import { suggestProblemSlug, validateProblemSlug } from '../slug';

beforeEach(() => {
  vi.clearAllMocks();
  api.constraints.mockResolvedValue(CONSTRAINTS);
  // 404 = the slug is free
  api.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Problem not found.'));
});

async function renderForm(role: 'editor' | 'owner' | 'solver' = 'editor') {
  renderInApp(<CreateProblemForm />, { space: makeSpace(role) });
  return screen.findByLabelText('Title');
}

const slugField = () => screen.getByLabelText('Slug') as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement;

describe('the create page (GRD-72)', () => {
  it('has title and slug at the top and no separate New problem form step', async () => {
    const title = await renderForm();
    expect(title).toBeTruthy();
    const labels = Array.from(document.querySelectorAll('label')).map((label) => label.textContent);
    expect(labels.indexOf('Title')).toBeLessThan(labels.indexOf('Slug'));
    expect(labels.indexOf('Slug')).toBeLessThan(labels.indexOf('Time limit (ms)'));
    expect(screen.getByLabelText('Statement (Markdown)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create draft' })).toBeNull();
    expect(screen.getByText(/Nobody else can see it until you publish it/)).toBeTruthy();
    expect(screen.getByText(/created when you save, not before/)).toBeTruthy();
  });

  it('creates nothing until Save', async () => {
    await renderForm();
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.type(screen.getByLabelText('Statement (Markdown)'), 'Add them.');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('suggests a slug from the title until the person edits it', async () => {
    const title = await renderForm();
    await userEvent.type(title, 'A + B (easy)');
    expect(slugField().value).toBe('a-b-easy');
    await userEvent.clear(slugField());
    await userEvent.type(slugField(), 'my-own');
    await userEvent.type(title, ' more');
    expect(slugField().value).toBe('my-own');
  });

  it('saves the first time with everything on the page in one request, then opens the editor', async () => {
    api.create.mockResolvedValue({ slug: 'sum' });
    const title = await renderForm();
    await userEvent.type(title, 'Sum');
    await userEvent.type(screen.getByLabelText('Statement (Markdown)'), 'Add them.');
    await userEvent.click(saveButton());
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith('team', {
      slug: 'sum',
      title: 'Sum',
      statement: 'Add them.',
      time_limit_ms: 1000,
      memory_limit_kb: 262144,
      allowed_languages: ['c', 'cpp', 'python'],
    });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/spaces/team/problems/sum/edit'));
  });

  it('keeps Save off until there is a title and a valid slug', async () => {
    await renderForm('owner');
    expect(saveButton().disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    await userEvent.clear(slugField());
    expect(saveButton().disabled).toBe(true);
  });

  it('explains that the slug is locked after the first save', async () => {
    await renderForm();
    expect(screen.getByText(/the slug is locked and cannot be changed/i)).toBeTruthy();
  });

  it.each([
    ['a', 'Use 2 to 64'],
    ['Has Space', 'Use 2 to 64'],
    ['-lead', 'Use 2 to 64'],
    ['new', 'reserved'],
    ['tests', 'reserved'],
  ])('refuses the slug %j before it is sent', async (value, message) => {
    const title = await renderForm();
    await userEvent.type(title, 'Sum');
    await userEvent.clear(slugField());
    await userEvent.type(slugField(), value);
    expect(await screen.findByText(new RegExp(message))).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('says a taken slug is taken as soon as it is typed, before Save', async () => {
    api.get.mockResolvedValue({ slug: 'sum' });
    const title = await renderForm();
    await userEvent.type(title, 'Sum');
    expect(await screen.findByText('A problem with this slug already exists in this Space.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(api.get).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' });
  });

  it('shows a slug clash that Core reports at Save next to the slug', async () => {
    api.create.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'A problem with this slug already exists in this Space.')
    );
    const title = await renderForm();
    await userEvent.type(title, 'Sum');
    await userEvent.click(saveButton());
    expect(await screen.findByText('A problem with this slug already exists in this Space.')).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('shows other field errors from Core next to their fields', async () => {
    api.create.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'statement', message: 'Use at most 100000 characters.' },
      ])
    );
    const title = await renderForm();
    await userEvent.type(title, 'Sum');
    await userEvent.click(saveButton());
    expect(await screen.findByText('Use at most 100000 characters.')).toBeTruthy();
  });

  it('checks the limits in the browser with the ranges Core sent', async () => {
    const title = await renderForm();
    await userEvent.type(title, 'Sum');
    await userEvent.clear(screen.getByLabelText('Time limit (ms)'));
    await userEvent.type(screen.getByLabelText('Time limit (ms)'), '50');
    expect(await screen.findByText('Use between 100 and 10000 ms.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('asks the browser to confirm leaving once something is typed, but not before', async () => {
    const title = await renderForm();
    const fresh = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(fresh);
    expect(fresh.defaultPrevented).toBe(false);
    await userEvent.type(title, 'Sum');
    const typed = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(true);
  });

  it('does not offer the form to someone who cannot add problems', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('solver') });
    expect(await screen.findByText('You cannot add problems here')).toBeTruthy();
    expect(screen.getByText(/Only owners and editors/)).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('says an archived Space is read-only', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    expect(await screen.findByText(/This Space is archived/)).toBeTruthy();
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

describe('validateProblemSlug', () => {
  it.each(['ab', 'two-sum', 'a_b', '007', 'x'.repeat(64)])('accepts %j', (slug) => {
    expect(validateProblemSlug(slug)).toBeUndefined();
  });
  it.each(['', 'a', 'A', '-ab', '_ab', 'a b', 'a/b', 'x'.repeat(65), 'new', 'edit', 'settings'])(
    'refuses %j',
    (slug) => {
      expect(validateProblemSlug(slug)).toBeTruthy();
    }
  );
});
