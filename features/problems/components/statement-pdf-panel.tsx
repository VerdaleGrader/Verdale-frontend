'use client';

import { useState } from 'react';
import { FileUploader, type UploadFile } from '@/components/ui/file-uploader';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { problemsApi, statementPdfUrl } from '../api/problems.api';
import { useProblemWorkspace } from './problem-workspace';

/**
 * The PDF side of the Statement tab: upload, replace and remove the file, with the limits Core
 * gave us. A PDF stays attached to the draft when the mode goes back to Markdown, so this panel
 * only changes the file; the mode itself is a field of the form.
 */
export function StatementPdfPanel({ readOnly, onChanged }: { readOnly: boolean; onChanged: () => void }) {
  const { target, editor, setEditor } = useProblemWorkspace();
  const toast = useToast();
  const [upload, setUpload] = useState<UploadFile | null>(null);
  const { max_bytes: maxBytes, max_pages: maxPages } = editor.constraints.statement_pdf;
  const attached = editor.version.statement_pdf;

  async function send(file: File) {
    const id = `${file.name}-${file.size}-${file.lastModified}`;
    const base = { id, name: file.name, size: file.size };
    if (file.size > maxBytes) {
      setUpload({
        ...base,
        status: 'rejected',
        message: `The file is too large. Use a PDF of at most ${formatBytes(maxBytes)}.`,
      });
      return;
    }
    setUpload({ ...base, status: 'uploading', progress: 0 });
    try {
      const next = await problemsApi.uploadStatementPdf(target, file, (progress) =>
        setUpload((current) => (current?.id === id ? { ...current, progress } : current))
      );
      setUpload(null);
      setEditor(next);
      onChanged();
      toast({ tone: 'success', title: 'PDF uploaded', description: 'Solvers will read it as the statement.' });
    } catch (caught) {
      const message =
        caught instanceof ApiError && caught.status === 400
          ? (caught.fieldError('file') ?? caught.message)
          : errorMessage(caught);
      setUpload({ ...base, status: 'error', message });
    }
  }

  async function remove() {
    if (upload) {
      setUpload(null);
      return;
    }
    try {
      const next = await problemsApi.removeStatementPdf(target);
      setEditor(next);
      onChanged();
      toast({ tone: 'success', title: 'PDF removed', description: 'The statement is Markdown again.' });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not remove the PDF', description: errorMessage(caught) });
    }
  }

  const files: UploadFile[] = upload
    ? [upload]
    : attached
      ? [
          {
            id: attached.sha256,
            name: 'Statement PDF',
            size: attached.size_bytes,
            status: 'done',
            message: `${attached.pages} ${attached.pages === 1 ? 'page' : 'pages'}`,
          },
        ]
      : [];

  return (
    <div className="flex flex-col gap-2">
      <FileUploader
        label={attached ? 'Replace the PDF statement' : 'Upload the PDF statement'}
        hint={`A PDF of at most ${formatBytes(maxBytes)} and ${maxPages} pages, not password-protected.`}
        accept="application/pdf,.pdf"
        files={files}
        disabled={readOnly || upload?.status === 'uploading'}
        onFiles={([file]) => file && void send(file)}
        onRemove={readOnly || upload?.status === 'uploading' ? undefined : () => void remove()}
      />
      {attached && !upload && (
        <p className="text-small">
          <a className="vd-link" href={statementPdfUrl(target, true)} download>
            Download the draft PDF
          </a>
        </p>
      )}
    </div>
  );
}
