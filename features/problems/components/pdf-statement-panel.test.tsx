import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { makeEditor } from '@/features/test-support';
import type { ProblemEditor } from '../types';

vi.mock('@/components/pdf/pdf-viewer', () => ({
  PdfViewer: ({ url }: { url: string }) => <div data-testid="viewer">{url}</div>,
}));
const api = vi.hoisted(() => ({ uploadStatementPdf: vi.fn(), update: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { PdfStatementPanel, StatementFormat, checkPdfFile } from './pdf-statement-panel';
import { WorkspaceContext } from './problem-workspace';

const LIMITS = { max_bytes: 10 * 1024 * 1024, max_pages: 10 };
const pdfFile = (name = 'statement.pdf', content = '%PDF-1.7\nhello') =>
  new File([content], name, { type: 'application/pdf' });

function pdfEditor(overrides: Partial<ProblemEditor['version']> = {}) {
  const editor = makeEditor();
  return {
    ...editor,
    version: {
      ...editor.version,
      statement_mode: 'pdf' as const,
      statement_pdf: { sha256: 'a'.repeat(64), size_bytes: 2048, pages: 3 },
      ...overrides,
    },
  };
}

function renderPanel(editor: ProblemEditor) {
  const setEditor = vi.fn();
  render(
    <ToastProvider>
      <WorkspaceContext.Provider
        value={{ target: { slug: 'team', problemSlug: 'sum' }, editor, setEditor, refresh: vi.fn() }}
      >
        <PdfStatementPanel />
      </WorkspaceContext.Provider>
    </ToastProvider>
  );
  return setEditor;
}

beforeEach(() => vi.clearAllMocks());

describe('checkPdfFile', () => {
  it('accepts a PDF by its first bytes', async () => {
    expect(await checkPdfFile(pdfFile(), LIMITS)).toBeUndefined();
  });
  it('refuses a file that is not a PDF whatever its name or type', async () => {
    const renamed = new File(['<html>'], 'statement.pdf', { type: 'application/pdf' });
    expect(await checkPdfFile(renamed, LIMITS)).toBe('“statement.pdf” is not a PDF file.');
  });
  it('refuses an empty file', async () => {
    expect(await checkPdfFile(pdfFile('empty.pdf', ''), LIMITS)).toBe('“empty.pdf” is empty.');
  });
  it('refuses a file over the limit and says the limits', async () => {
    const big = pdfFile('big.pdf');
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    const message = await checkPdfFile(big, LIMITS);
    expect(message).toContain('larger than 10 MiB');
    expect(message).toContain('at most 10 pages');
  });
});

describe('StatementFormat', () => {
  it('lets the author choose Markdown or PDF and says what each means', async () => {
    const onMode = vi.fn();
    render(<StatementFormat mode="markdown" pdf={null} readOnly={false} busy={false} onMode={onMode} />);
    expect(screen.getByRole('radio', { name: 'Markdown text' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('radio', { name: 'PDF file' }));
    expect(onMode).toHaveBeenCalledWith('pdf');
    expect(screen.getByText(/Choose PDF to use a file you already have/)).toBeTruthy();
  });
  it('says the sample testcases stay next to a PDF', () => {
    render(
      <StatementFormat
        mode="pdf"
        pdf={{ sha256: 'a'.repeat(64), size_bytes: 1, pages: 1 }}
        readOnly={false}
        busy={false}
        onMode={vi.fn()}
      />
    );
    expect(screen.getByText(/sample testcases are still shown next to it/)).toBeTruthy();
  });
  it('is locked when the version is read-only', () => {
    render(<StatementFormat mode="pdf" pdf={null} readOnly busy={false} onMode={vi.fn()} />);
    expect(screen.getByLabelText('PDF file').matches(':disabled')).toBe(true);
  });
});

describe('PdfStatementPanel', () => {
  it('shows the stored file and a preview of what solvers will read', () => {
    renderPanel(pdfEditor());
    expect(screen.getByText(/2 KiB · 3 pages/)).toBeTruthy();
    expect(screen.getByTestId('viewer').textContent).toBe('/api/v1/spaces/team/problems/sum/statement/pdf?draft=true');
    expect(screen.getByRole('button', { name: 'Replace PDF' })).toBeTruthy();
    expect(screen.getByText(/At most 10 MiB and 10 pages/)).toBeTruthy();
  });

  it('uploads with progress, then hands the new editor view up', async () => {
    const next = pdfEditor({ statement_pdf: { sha256: 'b'.repeat(64), size_bytes: 99, pages: 1 } });
    let report: (fraction: number) => void = () => undefined;
    let finish: (value: ProblemEditor) => void = () => undefined;
    api.uploadStatementPdf.mockImplementation(
      (_target: unknown, _file: File, onProgress: (fraction: number) => void) => {
        report = onProgress;
        return new Promise<ProblemEditor>((resolve) => {
          finish = resolve;
        });
      }
    );
    const setEditor = renderPanel(makeEditor());
    fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [pdfFile()] } });
    await waitFor(() => expect(api.uploadStatementPdf).toHaveBeenCalled());
    report(0.4);
    expect(await screen.findByText('Uploading… 40%')).toBeTruthy();
    expect((screen.getByLabelText('Uploading the PDF') as HTMLProgressElement).value).toBe(40);
    finish(next);
    await waitFor(() => expect(setEditor).toHaveBeenCalledWith(next));
    await waitFor(() => expect(screen.queryByText(/Uploading/)).toBeNull());
  });

  it('refuses a file that is not a PDF without sending it', async () => {
    renderPanel(makeEditor());
    fireEvent.change(screen.getByLabelText('Choose a PDF file'), {
      target: { files: [new File(['GIF89a'], 'cat.pdf', { type: 'application/pdf' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toBe('“cat.pdf” is not a PDF file.');
    expect(api.uploadStatementPdf).not.toHaveBeenCalled();
  });

  it('shows Core’s reason when the file has too many pages', async () => {
    api.uploadStatementPdf.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'file', message: '“statement.pdf” has 11 pages; at most 10 are allowed.' },
      ])
    );
    renderPanel(makeEditor());
    fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [pdfFile()] } });
    expect((await screen.findByRole('alert')).textContent).toBe(
      '“statement.pdf” has 11 pages; at most 10 are allowed.'
    );
  });

  it('is locked once the version is published', () => {
    const editor = pdfEditor();
    renderPanel({ ...editor, editable: false });
    expect((screen.getByRole('button', { name: 'Replace PDF' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
