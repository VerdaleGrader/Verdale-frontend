import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, makeProblem, makeSpace, renderInApp } from '@/features/test-support';
import type { ProblemEditor } from '../types';
import { WorkspaceContext } from './problem-workspace';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push, refresh: vi.fn() }) }));
const api = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn(), uploadImage: vi.fn(), remove: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { StatementEditor } from './statement-editor';

/** Plays the workspace: holds the editor view and swaps in what a save returns. */
import { useState } from 'react';
function Harness({ initial, onEditor }: { initial: ProblemEditor; onEditor?: (editor: ProblemEditor) => void }) {
  const [editor, setEditor] = useState(initial);
  return (
    <WorkspaceContext.Provider
      value={{
        target: { slug: 'team', problemSlug: 'sum' },
        editor,
        setEditor: (next) => {
          setEditor(next);
          onEditor?.(next);
        },
        refresh: async () => undefined,
      }}
    >
      <StatementEditor />
    </WorkspaceContext.Provider>
  );
}

const updated = (editor: ProblemEditor, change: Partial<ProblemEditor['version']>): ProblemEditor => ({
  ...editor,
  version: { ...editor.version, ...change },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.get.mockResolvedValue(makeProblem({ samples: [{ position: 1, input: '1 2\n', output: '3\n' }] }));
});
afterEach(() => vi.useRealTimers());

const settle = () => act(async () => vi.advanceTimersByTime(1600));

describe('the statement editor (GRD-28)', () => {
  it('shows the details and the statement, with limits in friendly units and the allowed ranges', async () => {
    renderInApp(<Harness initial={makeEditor()} />, { space: makeSpace('editor') });
    expect((await screen.findByLabelText('Title')) as HTMLInputElement).toHaveProperty('value', 'Sum of two numbers');
    expect((screen.getByLabelText('Time limit (ms)') as HTMLInputElement).value).toBe('1000');
    expect((screen.getByLabelText('Memory limit (MB)') as HTMLInputElement).value).toBe('256');
    expect(screen.getByText('Per testcase, 100 to 10000 ms.')).toBeTruthy();
    expect(screen.getByText('Per testcase, 16 to 1024 MB.')).toBeTruthy();
    expect(screen.getByLabelText('C++')).toHaveProperty('checked', true);
    expect((screen.getByLabelText('Statement (Markdown)') as HTMLTextAreaElement).value).toBe('Read $a$ and $b$.');
    expect(screen.getByText('All changes saved')).toBeTruthy();
  });

  it('previews the statement as a solver sees it, live, with maths and the sample tests', async () => {
    renderInApp(<Harness initial={makeEditor()} />);
    const preview = await screen.findByLabelText('Preview as a solver sees it');
    expect(await within(preview).findByText('Examples')).toBeTruthy();
    expect(preview.querySelectorAll('.katex').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Statement (Markdown)'), {
      target: { value: '## Hello\n\nUse $x^2$ here.' },
    });
    expect(within(preview).getByRole('heading', { name: 'Hello' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Squares' } });
    expect(within(preview).getByRole('heading', { name: 'Squares' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Time limit (ms)'), { target: { value: '2500' } });
    expect(within(preview).getByText('2.5 s')).toBeTruthy();
    expect(within(preview).getByText('Input')).toBeTruthy();
  });

  it('saves by itself a moment after typing stops, sending only what changed', async () => {
    const editor = makeEditor();
    api.update.mockResolvedValue(updated(editor, { statement: 'New text' }));
    renderInApp(<Harness initial={editor} />);
    fireEvent.change(await screen.findByLabelText('Statement (Markdown)'), { target: { value: 'New text' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(api.update).not.toHaveBeenCalled();
    await settle();
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, { statement: 'New text' });
    await waitFor(() => expect(screen.getByText(/^Saved at /)).toBeTruthy());
    // saved: nothing more to send
    await settle();
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('converts megabytes back to the kilobytes Core counts', async () => {
    const editor = makeEditor();
    api.update.mockResolvedValue(updated(editor, { memory_limit_kb: 131072, time_limit_ms: 2000 }));
    renderInApp(<Harness initial={editor} />);
    fireEvent.change(await screen.findByLabelText('Memory limit (MB)'), { target: { value: '128' } });
    fireEvent.change(screen.getByLabelText('Time limit (ms)'), { target: { value: '2000' } });
    await settle();
    expect(api.update).toHaveBeenCalledWith(expect.anything(), { time_limit_ms: 2000, memory_limit_kb: 131072 });
  });

  it('shows a mistake next to its field at once, and does not send it to Core', async () => {
    renderInApp(<Harness initial={makeEditor()} />);
    fireEvent.change(await screen.findByLabelText('Time limit (ms)'), { target: { value: '99999' } });
    fireEvent.change(screen.getByLabelText('Memory limit (MB)'), { target: { value: 'lots' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    expect(screen.getByText('Use between 100 and 10000 ms.')).toBeTruthy();
    expect(screen.getByText('Use a whole number of megabytes.')).toBeTruthy();
    expect(screen.getByText('Enter a title.')).toBeTruthy();
    expect((screen.getByLabelText('Time limit (ms)') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
    await settle();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('requires at least one language', async () => {
    renderInApp(<Harness initial={makeEditor({ version: { ...makeEditor().version, allowed_languages: ['c'] } })} />);
    await userEvent.click(await screen.findByLabelText('C'));
    expect(screen.getByRole('alert').textContent).toBe('Allow at least one language.');
    await userEvent.click(screen.getByLabelText('Python 3'));
    await settle();
    expect(api.update).toHaveBeenCalledWith(expect.anything(), { allowed_languages: ['python'] });
  });

  it('puts a validation message from Core next to its field and says the save did not happen', async () => {
    api.update.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'statement', message: 'Remove the NUL character (U+0000).' },
      ])
    );
    renderInApp(<Harness initial={makeEditor()} />);
    fireEvent.change(await screen.findByLabelText('Statement (Markdown)'), { target: { value: 'bad' } });
    await settle();
    expect(await screen.findByText('Remove the NUL character (U+0000).')).toBeTruthy();
    expect(screen.getByText('Not saved: Check the highlighted fields.')).toBeTruthy();
    // fixing it clears the message and saves again
    api.update.mockResolvedValue(updated(makeEditor(), { statement: 'good' }));
    fireEvent.change(screen.getByLabelText('Statement (Markdown)'), { target: { value: 'good' } });
    expect(screen.queryByText('Remove the NUL character (U+0000).')).toBeNull();
    await settle();
    await waitFor(() => expect(screen.getByText(/^Saved at /)).toBeTruthy());
  });

  it('keeps what was typed and offers "Try again" when the network fails', async () => {
    const editor = makeEditor();
    api.update.mockRejectedValueOnce(
      new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.')
    );
    api.update.mockResolvedValue(updated(editor, { title: 'Kept' }));
    renderInApp(<Harness initial={editor} />);
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Kept' } });
    await settle();
    expect(await screen.findByText(/Not saved: Could not reach the server/)).toBeTruthy();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Kept');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText(/^Saved at /)).toBeTruthy());
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it('warns before the tab is closed while there are unsaved changes', async () => {
    renderInApp(<Harness initial={makeEditor()} />);
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    await screen.findByLabelText('Title');
    expect(closing()).toBe(false);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed' } });
    expect(closing()).toBe(true);
  });

  it('inserts an uploaded picture into the statement at the cursor', async () => {
    api.uploadImage.mockResolvedValue({
      url: '/api/v1/assets/abc.png',
      markdown: '![](/api/v1/assets/abc.png)',
      content_type: 'image/png',
      size_bytes: 12,
    });
    renderInApp(<Harness initial={makeEditor()} />);
    const area = (await screen.findByLabelText('Statement (Markdown)')) as HTMLTextAreaElement;
    area.setSelectionRange(5, 5);
    const input = screen.getByLabelText('Choose an image to insert');
    await userEvent.upload(input, new File(['png'], 'my figure.png', { type: 'image/png' }));
    await waitFor(() => expect(area.value).toContain('![my figure](/api/v1/assets/abc.png)'));
    expect(area.value.startsWith('Read ')).toBe(true);
    expect(api.uploadImage).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, expect.any(File));
  });

  it('shows why a picture was refused', async () => {
    api.uploadImage.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'file', message: '“x.svg” is not a PNG, JPEG or WebP image.' },
      ])
    );
    renderInApp(<Harness initial={makeEditor()} />);
    await screen.findByLabelText('Statement (Markdown)');
    await userEvent.upload(
      screen.getByLabelText('Choose an image to insert'),
      new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }),
      { applyAccept: false }
    );
    expect((await screen.findByRole('alert')).textContent).toBe('“x.svg” is not a PNG, JPEG or WebP image.');
  });

  it('is read-only when the version is published: no fields, no autosave, no delete', async () => {
    renderInApp(
      <Harness
        initial={makeEditor({
          editable: false,
          status: 'published',
          version: { ...makeEditor().version, status: 'published' },
        })}
      />
    );
    const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
    expect(title.disabled).toBe(true);
    expect((screen.getByLabelText('Statement (Markdown)') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Insert image/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete draft' })).toBeNull();
    await settle();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('deletes a draft only after confirming, then goes back to the Space', async () => {
    api.remove.mockResolvedValue(undefined);
    renderInApp(<Harness initial={makeEditor()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete draft' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.remove).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/spaces/team'));
  });
});
