'use client';

import { ProblemStatement } from '@/components/grader/problem-statement';
import { SampleIO } from '@/components/grader/sample-io';
import { MarkdownView } from '@/components/markdown/markdown-view';
import { problemsApi, statementPdfUrl, type ProblemTarget } from '../api/problems.api';
import { kilobytesToMegabytes } from '../types';
import { PdfViewer } from './pdf-viewer';

export interface ProblemReaderProps {
  title: string;
  spaceName?: string;
  author?: string;
  authorAvatarUrl?: string | null;
  timeLimitMs: number;
  memoryLimitKb: number;
  statement: string;
  /** `pdf` shows the uploaded PDF instead of the Markdown; the examples stay below it either way. */
  statementMode?: 'markdown' | 'pdf';
  /** The PDF to show in `pdf` mode. `draft` asks Core for the draft's file (staff previews). Null when none is uploaded. */
  pdf?: { target: ProblemTarget; draft?: boolean; version: string; sizeBytes: number } | null;
  samples: Array<{ position: number; input: string; output: string }>;
  /** Shown instead of the examples while they are loading. */
  samplesNote?: string;
}

/**
 * The reading surface of a problem. The solve page and the editor's preview
 * both use it, so what an author previews is what a solver gets.
 */
export function ProblemReader({
  title,
  spaceName,
  author,
  authorAvatarUrl,
  timeLimitMs,
  memoryLimitKb,
  statement,
  statementMode = 'markdown',
  pdf,
  samples,
  samplesNote,
}: ProblemReaderProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProblemStatement
        title={title || 'Untitled problem'}
        space={spaceName}
        author={author}
        authorAvatarUrl={authorAvatarUrl}
        limits={{ timeMs: timeLimitMs, memoryMb: kilobytesToMegabytes(memoryLimitKb) }}
      >
        {statementMode === 'pdf' ? (
          pdf ? (
            <PdfViewer
              fileKey={`${pdf.target.slug}/${pdf.target.problemSlug}/${pdf.draft ? 'draft' : 'current'}/${pdf.version}`}
              load={() => problemsApi.statementPdf(pdf.target, pdf.draft ?? false)}
              downloadHref={statementPdfUrl(pdf.target, pdf.draft)}
              sizeBytes={pdf.sizeBytes}
            />
          ) : (
            <p className="text-text-muted">No PDF has been uploaded yet.</p>
          )
        ) : statement.trim() ? (
          <MarkdownView source={statement} />
        ) : (
          <p className="text-text-muted">The statement is empty.</p>
        )}
      </ProblemStatement>
      {(samples.length > 0 || samplesNote) && (
        <section aria-labelledby="examples-heading" className="flex max-w-[var(--measure)] flex-col gap-3">
          <h2 id="examples-heading" className="text-h2">
            Examples
          </h2>
          {samples.map((sample) => (
            <SampleIO
              key={sample.position}
              index={samples.length > 1 ? sample.position : undefined}
              input={sample.input}
              output={sample.output}
            />
          ))}
          {samples.length === 0 && samplesNote && <p className="text-small text-text-muted">{samplesNote}</p>}
        </section>
      )}
    </div>
  );
}
