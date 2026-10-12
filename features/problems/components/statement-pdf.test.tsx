import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, makeProblem, makeSpace, renderInApp } from '@/features/test-support';
import type { ProblemEditor } from '../types';
import { WorkspaceContext } from './problem-workspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const api = vi.hoisted(() => ({
  update: vi.fn(),
  get: vi.fn(),
  uploadStatementPdf: vi.fn(),
  removeStatementPdf: vi.fn(),
  statementPdf: vi.fn(),
}));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));
const pdf = vi.hoisted(() => ({ loadPdf: vi.fn() }));
vi.mock('../pdf/load-pdf', () => pdf);

import { StatementEditor } from './statement-editor';

function Harness({ initial }: { initial: ProblemEditor }) {
  const [editor, setEditor] = useState(initial);
  return (
    <WorkspaceContext.Provider
      value={{ target: { slug: 'team', problemSlug: 'sum' }, editor, setEditor, refresh: async () => undefined }}
    >
      <StatementEditor />
    </WorkspaceContext.Provider>
  );
}

const attached = { size_bytes: 52_000, pages: 3, sha256: 'a'.repeat(64) };
const withPdf = (mode: 'markdown' | 'pdf', editable = true): ProblemEditor => {
  const base = makeEditor();
  return { ...base, editable, version: { ...base.version, statement_mode: mode, statement_pdf: attached } };
};
const settle = () => act(async () => vi.advanceTimersByTime(1600));
const pdfFile = (name = 'statement.pdf', size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'application/pdf' });
const fileInput = () => document.querySelector('input[type=file][accept*="pdf"]') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.get.mockResolvedValue(makeProblem());
  api.statementPdf.mockResolvedValue(new ArrayBuffer(8));
  pdf.loadPdf.mockResolvedValue({
    pages: [{ width: 600, height: 800 }],
    render: () => ({ done: Promise.resolve(), cancel: vi.fn() }),
    destroy: vi.fn(),
  });
});
afterEach(() => vi.useRealTimers());

describe('PDF statement mode in the editor (GRD-74)', () => {
  it('offers Markdown and PDF, and saves the mode that is chosen', async () => {
    api.update.mockResolvedValue(withPdf('pdf'));
    renderInApp(<Harness initial={makeEditor()} />, { space: makeSpace('editor') });
    const group = await screen.findByRole('radiogroup', { name: 'Statement format' });
    expect(
      within(group)
        .getByRole('radio', { name: /Markdown/ })
        .getAttribute('aria-checked')
    ).toBe('true');
    await userEvent.click(within(group).getByRole('radio', { name: /PDF/ }));
    expect(screen.queryByLabelText('Statement (Markdown)')).toBeNull();
    expect(screen.getByText('Upload the PDF statement')).toBeTruthy();
    await settle();
    expect(api.update).toHaveBeenCalledWith(expect.anything(), { statement_mode: 'pdf' });
  });

  it('shows the limits Core gave and keeps the sample examples apart from the PDF', async () => {
    renderInApp(<Harness initial={withPdf('pdf')} />);
    expect(await screen.findByText(/at most 10 MiB and 10 pages/)).toBeTruthy();
    expect(screen.getByText('3 pages')).toBeTruthy();
    const preview = screen.getByLabelText('Preview as a solver sees it');
    expect(await within(preview).findByText('Examples')).toBeTruthy();
    // staff preview asks for the draft file
    await waitFor(() => expect(api.statementPdf).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, true));
    expect(screen.getByRole('link', { name: 'Download the draft PDF' }).getAttribute('href')).toContain(
      'statement.pdf?draft=true'
    );
  });

  it('uploads a PDF with progress and then shows it as the attached file', async () => {
    let finish: (editor: ProblemEditor) => void = () => undefined;
    api.uploadStatementPdf.mockImplementation(
      (_target, _file, onProgress: (percent: number) => void) =>
        new Promise<ProblemEditor>((resolve) => {
          onProgress(40);
          finish = resolve;
        })
    );
    renderInApp(<Harness initial={makeEditor({ version: { ...makeEditor().version, statement_mode: 'pdf' } })} />);
    await screen.findByText('Upload the PDF statement');
    await userEvent.upload(fileInput(), pdfFile());
    expect(await screen.findByText(/40%/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Uploading statement.pdf' })).toBeTruthy();
    await act(async () => finish(withPdf('pdf')));
    expect(await screen.findByText('3 pages')).toBeTruthy();
    expect(screen.getByText('Replace the PDF statement')).toBeTruthy();
    expect(screen.getByText('PDF uploaded')).toBeTruthy();
  });

  it.each([
    ['not a PDF', '“notes.txt” is not a PDF file.'],
    ['password protected', 'The PDF is password protected. Remove the password and upload it again.'],
    ['too many pages', 'The PDF has 14 pages; at most 10 are allowed.'],
  ])("shows Core's message when the file is %s", async (_name, message) => {
    api.uploadStatementPdf.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [{ field: 'file', message }])
    );
    renderInApp(<Harness initial={withPdf('pdf')} />);
    await screen.findByText('Replace the PDF statement');
    await userEvent.upload(fileInput(), pdfFile('notes.txt'));
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    // the old file stays attached on the server; dismissing the error shows it again
    await userEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }));
    expect(screen.getByText('3 pages')).toBeTruthy();
    expect(api.removeStatementPdf).not.toHaveBeenCalled();
  });

  it('refuses a file over the size limit without sending it', async () => {
    renderInApp(<Harness initial={withPdf('pdf')} />);
    await screen.findByText('Replace the PDF statement');
    await userEvent.upload(fileInput(), pdfFile('big.pdf', 10 * 1024 * 1024 + 1));
    expect((await screen.findByRole('alert')).textContent).toContain('too large');
    expect(api.uploadStatementPdf).not.toHaveBeenCalled();
  });

  it('reports a network failure on upload', async () => {
    api.uploadStatementPdf.mockRejectedValue(new ApiError(0, 'NETWORK', 'Could not reach the server.'));
    renderInApp(<Harness initial={withPdf('pdf')} />);
    await screen.findByText('Replace the PDF statement');
    await userEvent.upload(fileInput(), pdfFile());
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the server.');
  });

  it('removes the PDF and goes back to Markdown', async () => {
    api.removeStatementPdf.mockResolvedValue(makeEditor());
    renderInApp(<Harness initial={withPdf('pdf')} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Statement PDF' }));
    expect(await screen.findByLabelText('Statement (Markdown)')).toBeTruthy();
    expect(api.removeStatementPdf).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' });
  });

  it('keeps the PDF attached when switching back to Markdown, and the Markdown text with it', async () => {
    api.update.mockResolvedValue(withPdf('markdown'));
    renderInApp(<Harness initial={withPdf('pdf')} />);
    await userEvent.click(await screen.findByRole('radio', { name: /Markdown/ }));
    expect(((await screen.findByLabelText('Statement (Markdown)')) as HTMLTextAreaElement).value).toBe(
      'Read $a$ and $b$.'
    );
    expect(screen.getByText(/A PDF is still attached to this draft/)).toBeTruthy();
    await settle();
    expect(api.update).toHaveBeenCalledWith(expect.anything(), { statement_mode: 'markdown' });
    expect(api.removeStatementPdf).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: /PDF/ }));
    expect(screen.getByText('3 pages')).toBeTruthy();
  });

  it('is read-only for observers: the mode and the file cannot be changed', async () => {
    renderInApp(<Harness initial={withPdf('pdf', false)} />, { space: makeSpace('observer') });
    const radio = await screen.findByRole('radio', { name: /PDF/ });
    expect(radio.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('radio', { name: /Markdown/ }).hasAttribute('disabled')).toBe(true);
    expect(fileInput().disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove Statement PDF' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Markdown/ }));
    await settle();
    expect(api.update).not.toHaveBeenCalled();
  });
});
