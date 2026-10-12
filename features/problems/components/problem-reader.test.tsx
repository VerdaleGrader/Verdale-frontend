import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';

const api = vi.hoisted(() => ({ statementPdf: vi.fn() }));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));
const pdf = vi.hoisted(() => ({ loadPdf: vi.fn() }));
vi.mock('../pdf/load-pdf', () => pdf);

import { ProblemReader } from './problem-reader';

const base = {
  title: 'Sum',
  timeLimitMs: 1000,
  memoryLimitKb: 262144,
  statement: '## Task\n\nAdd them.',
  samples: [{ position: 1, input: '1 2\n', output: '3\n' }],
};
const target = { slug: 'team', problemSlug: 'sum' };

beforeEach(() => {
  vi.clearAllMocks();
  api.statementPdf.mockResolvedValue(new ArrayBuffer(8));
  pdf.loadPdf.mockResolvedValue({
    pages: [{ width: 600, height: 800 }],
    render: () => ({ done: Promise.resolve(), cancel: vi.fn() }),
    destroy: vi.fn(),
  });
});

describe('the problem reader in PDF mode (GRD-74)', () => {
  it('shows the PDF instead of the Markdown, with the examples always beside it', async () => {
    render(
      <ProblemReader {...base} statementMode="pdf" pdf={{ target, version: '1', sizeBytes: 5000 }} statement="" />
    );
    expect(await screen.findByText('Page 1 of 1')).toBeTruthy();
    expect(screen.queryByText('The statement is empty.')).toBeNull();
    expect(api.statementPdf).toHaveBeenCalledWith(target, false);
    expect(screen.getByRole('link', { name: /Download PDF/ }).getAttribute('href')).toBe(
      '/api/v1/spaces/team/problems/sum/statement.pdf'
    );
    const examples = screen.getByRole('heading', { name: 'Examples' }).closest('section')!;
    expect(within(examples).getByText('Input')).toBeTruthy();
  });

  it('asks for the draft file when previewing a draft', async () => {
    render(<ProblemReader {...base} statementMode="pdf" pdf={{ target, draft: true, version: 'x', sizeBytes: 1 }} />);
    await screen.findByText('Page 1 of 1');
    expect(api.statementPdf).toHaveBeenCalledWith(target, true);
  });

  it('falls back to a message and a download link when the PDF cannot be drawn', async () => {
    pdf.loadPdf.mockRejectedValue(new Error('broken'));
    render(<ProblemReader {...base} statementMode="pdf" pdf={{ target, version: '1', sizeBytes: 1 }} />);
    expect((await screen.findByRole('alert')).textContent).toContain('could not be shown here');
    expect(screen.getByRole('link', { name: /Download PDF/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Examples' })).toBeTruthy();
  });

  it('says the file is unavailable when Core answers 404', async () => {
    api.statementPdf.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Not found'));
    render(<ProblemReader {...base} statementMode="pdf" pdf={{ target, version: '1', sizeBytes: 1 }} />);
    expect((await screen.findByRole('alert')).textContent).toContain('not available');
  });

  it('says so when a PDF-mode draft has no file yet', () => {
    render(<ProblemReader {...base} statementMode="pdf" pdf={null} />);
    expect(screen.getByText('No PDF has been uploaded yet.')).toBeTruthy();
    expect(api.statementPdf).not.toHaveBeenCalled();
  });

  it('keeps showing Markdown in Markdown mode, even when a PDF is attached', () => {
    render(<ProblemReader {...base} statementMode="markdown" pdf={{ target, version: '1', sizeBytes: 1 }} />);
    expect(screen.getByRole('heading', { name: 'Task' })).toBeTruthy();
    expect(api.statementPdf).not.toHaveBeenCalled();
  });
});
