import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, makeSpace, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ problemSlug: 'sum' }),
  usePathname: () => '/spaces/team/problems/sum/edit',
}));
const api = vi.hoisted(() => ({ editor: vi.fn(), publish: vi.fn(), archive: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { ProblemWorkspace } from './problem-workspace';

beforeEach(() => vi.clearAllMocks());

function renderWorkspace(editor = makeEditor(), space = makeSpace('editor')) {
  api.editor.mockResolvedValue(editor);
  return renderInApp(
    <ProblemWorkspace>
      <p>tab content</p>
    </ProblemWorkspace>,
    { space }
  );
}

describe('the authoring workspace', () => {
  it('shows the problem, its status, the tabs with counts and the content', async () => {
    renderWorkspace();
    expect(await screen.findByRole('heading', { name: 'Sum of two numbers' })).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Version 1')).toBeTruthy();
    const tabs = screen.getByRole('navigation', { name: 'Problem sections' });
    expect(within(tabs).getByRole('link', { name: 'Statement' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum/edit'
    );
    expect(within(tabs).getByRole('link', { name: /Testcases/ }).textContent).toContain('2');
    expect(
      within(tabs)
        .getByRole('link', { name: /Solutions/ })
        .getAttribute('href')
    ).toBe('/spaces/team/problems/sum/edit/solutions');
    expect(screen.getByText('tab content')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Preview as solver' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum'
    );
  });

  it('turns away someone who cannot edit, and says what they can do instead', async () => {
    api.editor.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Only owners and editors can do this.'));
    renderInApp(<ProblemWorkspace>x</ProblemWorkspace>, { space: makeSpace('solver') });
    expect(await screen.findByText('Only the Space’s staff can open the editor')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Team' }).getAttribute('href')).toBe('/spaces/team');
  });

  it('says when the problem does not exist', async () => {
    api.editor.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Problem not found.'));
    renderInApp(<ProblemWorkspace>x</ProblemWorkspace>);
    expect(await screen.findByText('Problem not found')).toBeTruthy();
  });

  it('offers a retry when loading fails', async () => {
    api.editor.mockRejectedValueOnce(new ApiError(503, 'UNAVAILABLE', 'Down for a moment.'));
    api.editor.mockResolvedValue(makeEditor());
    renderInApp(<ProblemWorkspace>x</ProblemWorkspace>);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Sum of two numbers' })).toBeTruthy();
  });

  it('says a published version is read-only', async () => {
    renderWorkspace(
      makeEditor({
        status: 'published',
        editable: false,
        version: { ...makeEditor().version, status: 'published', published_at: '2026-10-11T00:00:00Z' },
      })
    );
    expect(await screen.findByText(/published and can no longer be changed/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View as solver' })).toBeTruthy();
  });

  it('says an archived Space makes everything read-only', async () => {
    renderWorkspace(makeEditor({ editable: false }), makeSpace('owner', { archived_at: '2026-10-11T00:00:00Z' }));
    expect(await screen.findByText(/This Space is archived, so its problems are read-only/)).toBeTruthy();
  });

  it('lets an observer read the draft but offers no publishing and says it is read-only', async () => {
    renderWorkspace(makeEditor(), makeSpace('observer'));
    expect(await screen.findByText(/You can read everything here as an observer/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });
});

describe('publishing', () => {
  it('shows the checklist, and publishes only after a confirmation that says what freezes', async () => {
    api.publish.mockResolvedValue(
      makeEditor({
        status: 'published',
        editable: false,
        version: { ...makeEditor().version, status: 'published', published_at: '2026-10-11T00:00:00Z' },
      })
    );
    renderWorkspace();
    expect(await screen.findByRole('heading', { name: 'Before you publish (5 of 5 ready)' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/frozen once it is published/)).toBeTruthy();
    expect(api.publish).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }));
    expect(await screen.findByText(/Published\. Solvers can read it/)).toBeTruthy();
    expect(screen.getByText('Published', { selector: 'span' })).toBeTruthy();
  });

  it('keeps Publish off until every check is green, and says what is missing', async () => {
    renderWorkspace(
      makeEditor({
        can_publish: false,
        publish_checks: [
          { key: 'statement', ok: true, message: 'The statement is written.' },
          { key: 'languages', ok: true, message: 'At least one language is allowed.' },
          { key: 'tests', ok: true, message: '2 test(s) added.' },
          {
            key: 'sample_test',
            ok: false,
            message: 'Mark at least one testcase as a sample so solvers can see an example.',
          },
          { key: 'solution', ok: false, message: 'Attach a reference solution and mark it as primary.' },
        ],
      })
    );
    expect(await screen.findByRole('heading', { name: 'Before you publish (3 of 5 ready)' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Mark at least one testcase as a sample so solvers can see an example.')).toBeTruthy();
    expect(screen.getAllByLabelText('Still to do')).toHaveLength(2);
    expect(screen.getAllByLabelText('Done')).toHaveLength(3);
  });

  it('shows what Core says is missing when it refuses, even though the page thought it was ready', async () => {
    api.publish.mockRejectedValue(
      new ApiError(409, 'PUBLISH_BLOCKED', 'The problem is not ready to publish.', [
        { field: 'solution', message: 'Attach a reference solution and mark it as primary.' },
      ])
    );
    renderWorkspace();
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Attach a reference solution and mark it as primary.');
  });

  it('archives a published problem after confirming', async () => {
    api.archive.mockResolvedValue(makeEditor({ status: 'archived', editable: false }));
    renderWorkspace(
      makeEditor({
        status: 'published',
        editable: false,
        version: { ...makeEditor().version, status: 'published', published_at: '2026-10-11T00:00:00Z' },
      })
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/nobody can submit new solutions/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive problem' }));
    await waitFor(() => expect(api.archive).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull());
    expect(screen.getByText('Archived', { selector: 'span' })).toBeTruthy();
  });
});
