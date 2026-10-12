import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeSpace, renderInApp } from '@/features/test-support';

const nav = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, back: nav.back, replace: vi.fn() }),
  usePathname: () => '/spaces/team/problems/new',
}));
const api = vi.hoisted(() => ({ create: vi.fn(), slugTaken: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { CreateProblemForm } from './create-problem-form';
import { problemSlugError, suggestProblemSlug } from '../slug';

beforeEach(() => {
  vi.clearAllMocks();
  api.slugTaken.mockResolvedValue(false);
});

describe('the create-problem page (GRD-72)', () => {
  const slugBox = () => screen.getByLabelText('Slug') as HTMLInputElement;

  it('has the title, the slug and the statement on one page, and says it starts as a draft', () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(slugBox()).toBeTruthy();
    expect(screen.getByLabelText('Statement (Markdown)')).toBeTruthy();
    expect(screen.getByText('It starts as a draft in Team. Nobody else can see it until you publish it.')).toBeTruthy();
    expect(screen.getByText(/cannot be changed afterwards/)).toBeTruthy();
  });

  it('suggests a slug from the title until the person edits it', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    const title = screen.getByLabelText('Title');
    await userEvent.type(title, 'A + B (easy)');
    expect(slugBox().value).toBe('a-b-easy');
    await userEvent.clear(slugBox());
    await userEvent.type(slugBox(), 'my-own');
    await userEvent.type(title, ' more');
    expect(slugBox().value).toBe('my-own');
  });

  it('creates nothing until Save, then makes the draft with everything in one request and opens the editor', async () => {
    api.create.mockResolvedValue({ slug: 'sum' });
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.type(screen.getByLabelText('Statement (Markdown)'), 'Add $a$ and $b$.');
    expect(api.create).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith('team', { slug: 'sum', title: 'Sum', statement: 'Add $a$ and $b$.' })
    );
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/spaces/team/problems/sum/edit'));
  });

  it('leaves no draft behind when the person cancels', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(nav.back).toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('asks before the tab closes while there is unsaved work, and not when the page is empty', async () => {
    const empty = renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(closing()).toBe(false);
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    expect(closing()).toBe(true);
    empty.unmount();
  });

  it('explains a missing title and slug after a click on Save, without calling Core', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a title.')).toBeTruthy();
    expect(screen.getByText('Enter a slug.')).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('checks the slug while typing and refuses to save one that is not allowed', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.clear(slugBox());
    await userEvent.type(slugBox(), 'a');
    expect(screen.getByText('Use at least 2 characters.')).toBeTruthy();
    await userEvent.type(slugBox(), '!');
    expect(screen.getByText(/Use lower-case letters, digits/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('tells the person a slug is taken in this Space before saving', async () => {
    api.slugTaken.mockResolvedValue(true);
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    expect(await screen.findByText(/already has a problem with this slug/)).toBeTruthy();
    expect(api.slugTaken).toHaveBeenLastCalledWith('team', 'sum');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('still lets Core decide when the duplicate check cannot be made', async () => {
    api.slugTaken.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
    api.create.mockResolvedValue({ slug: 'sum' });
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
  });

  it('shows a taken or reserved slug from Core next to the slug field', async () => {
    api.create.mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'A problem with this slug already exists in this Space.')
    );
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A problem with this slug already exists in this Space.')).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();

    api.create.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'slug', message: 'This slug is reserved. Pick another.' },
      ])
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This slug is reserved. Pick another.')).toBeTruthy();
  });

  it('shows the preview of the statement as a solver reads it', async () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('editor') });
    await userEvent.type(screen.getByLabelText('Title'), 'Sum');
    fireEvent.change(screen.getByLabelText('Statement (Markdown)'), {
      target: { value: '## Task\n\nRead two numbers.' },
    });
    const preview = screen.getByLabelText('Preview as a solver sees it');
    expect(within(preview).getByRole('heading', { name: 'Sum' })).toBeTruthy();
    expect(within(preview).getByRole('heading', { name: 'Task' })).toBeTruthy();
  });

  it('does not offer the form to someone who cannot add problems', () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('solver') });
    expect(screen.getByText('You cannot add problems here')).toBeTruthy();
    expect(screen.getByText(/Only owners and editors/)).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(api.slugTaken).not.toHaveBeenCalled();
  });

  it('says an archived Space is read-only', () => {
    renderInApp(<CreateProblemForm />, { space: makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }) });
    expect(screen.getByText(/This Space is archived/)).toBeTruthy();
  });
});

describe('problemSlugError', () => {
  it.each([
    ['', 'Enter a slug.'],
    ['a', 'Use at least 2 characters.'],
    ['x'.repeat(65), 'Use at most 64 characters.'],
    ['Two', expect.stringMatching(/lower-case/)],
    ['-ab', expect.stringMatching(/starting with a letter or digit/)],
    ['a b', expect.stringMatching(/lower-case/)],
    ['ab', undefined],
    ['a_b-9', undefined],
    ['x'.repeat(64), undefined],
  ])('%j -> %j', (slug, message) => {
    expect(problemSlugError(slug)).toEqual(message);
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
