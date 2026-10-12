'use client';

import { FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import { PdfViewer } from '@/components/pdf/pdf-viewer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { problemsApi, statementPdfUrl } from '../api/problems.api';
import { formatBytes, type ProblemEditor } from '../types';
import { useProblemWorkspace } from './problem-workspace';

type Mode = 'markdown' | 'pdf';

/** The first KiB of a file as text. FileReader instead of Blob.text(), which older browsers and jsdom lack. */
function readHead(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new TextDecoder('latin1').decode(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file.slice(0, 1024));
  });
}

/** Why a file is turned away before it is sent, or nothing when it looks right. Core checks again from the bytes. */
export async function checkPdfFile(
  file: File,
  limits: { max_bytes: number; max_pages: number }
): Promise<string | undefined> {
  const label = file.name ? `“${file.name}”` : 'The file';
  if (file.size === 0) return `${label} is empty.`;
  if (file.size > limits.max_bytes) {
    return `${label} is larger than ${formatBytes(limits.max_bytes)}. Use a smaller PDF (at most ${limits.max_pages} pages).`;
  }
  // The first bytes decide, not the name: a renamed image or page is not a PDF.
  const head = await readHead(file);
  if (!head.includes('%PDF-')) return `${label} is not a PDF file.`;
  return undefined;
}

/** Choose how the statement is given: Markdown text, or an uploaded PDF. The sample tests are the same either way. */
export function StatementFormat({
  mode,
  pdf,
  readOnly,
  busy,
  onMode,
}: {
  mode: Mode;
  pdf: ProblemEditor['version']['statement_pdf'];
  readOnly: boolean;
  busy: boolean;
  onMode: (mode: Mode) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={readOnly || busy}>
      <legend className="vd-label">Statement format</legend>
      <div className="flex flex-wrap gap-6">
        <label className="text-body flex items-center gap-2">
          <input
            type="radio"
            name="statement-format"
            checked={mode === 'markdown'}
            onChange={() => onMode('markdown')}
          />
          Markdown text
        </label>
        <label className="text-body flex items-center gap-2">
          <input type="radio" name="statement-format" checked={mode === 'pdf'} onChange={() => onMode('pdf')} />
          PDF file
        </label>
      </div>
      <p className="vd-hint">
        {mode === 'pdf'
          ? 'Solvers read your PDF. The sample tests are still shown next to it, and the Markdown text is kept if you switch back.'
          : pdf
            ? 'Solvers read the Markdown text. The PDF you uploaded is kept if you switch to PDF.'
            : 'Solvers read the Markdown text. Choose PDF to use a file you already have.'}
      </p>
    </fieldset>
  );
}

/** The PDF mode of the Statement tab: the current file, an upload with progress, and what solvers will see. */
export function PdfStatementPanel() {
  const { target, editor, setEditor } = useProblemWorkspace();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = !editor.editable;
  const pdf = editor.version.statement_pdf;
  const limits = editor.constraints.pdf;
  const uploading = progress !== null;

  async function upload(file: File) {
    setError(null);
    const problem = await checkPdfFile(file, limits);
    if (problem) {
      setError(problem);
      return;
    }
    setProgress(0);
    try {
      setEditor(await problemsApi.uploadStatementPdf(target, file, setProgress));
      toast({ tone: 'success', title: 'PDF uploaded', description: 'This is the statement solvers will read.' });
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.fieldError('file') ?? caught.message) : errorMessage(caught));
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section aria-labelledby="statement-heading" className="flex flex-col gap-3">
      <h2 id="statement-heading" className="text-h2">
        Statement (PDF)
      </h2>
      <p className="text-small text-text-muted max-w-[var(--measure)]">
        At most {formatBytes(limits.max_bytes)} and {limits.max_pages} pages. Password-protected files are not accepted.
        Add the sample tests on the Tests tab; they are shown next to the PDF.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={readOnly || uploading} onClick={() => fileInput.current?.click()}>
          <FileText aria-hidden />
          {pdf ? 'Replace PDF' : 'Upload PDF'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="vd-sr"
          tabIndex={-1}
          aria-label="Choose a PDF file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        {pdf && !uploading && (
          <span className="text-small text-text-muted">
            {formatBytes(pdf.size_bytes)} · {pdf.pages} {pdf.pages === 1 ? 'page' : 'pages'}
          </span>
        )}
      </div>
      {uploading && (
        <div className="flex max-w-md flex-col gap-1">
          <progress
            className="vd-progress"
            aria-label="Uploading the PDF"
            value={Math.round((progress ?? 0) * 100)}
            max={100}
          />
          <span role="status" className="text-small text-text-muted">
            Uploading… {Math.round((progress ?? 0) * 100)}%
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="vd-hint vd-hint--error">
          {error}
        </p>
      )}
      {pdf ? (
        <PdfViewer key={pdf.sha256} url={statementPdfUrl(target, { draft: true })} title={editor.version.title} />
      ) : (
        <p className="text-small text-text-muted">No PDF yet. Upload one to see it here as solvers will.</p>
      )}
    </section>
  );
}
