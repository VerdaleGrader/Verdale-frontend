'use client';

import { ProblemStatement } from '@/components/grader/problem-statement';
import { SampleIO } from '@/components/grader/sample-io';
import { MarkdownView } from '@/components/markdown/markdown-view';
import { kilobytesToMegabytes } from '../types';

export interface ProblemReaderProps {
  title: string;
  spaceName?: string;
  author?: string;
  timeLimitMs: number;
  memoryLimitKb: number;
  statement: string;
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
  timeLimitMs,
  memoryLimitKb,
  statement,
  samples,
  samplesNote,
}: ProblemReaderProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProblemStatement
        title={title || 'Untitled problem'}
        space={spaceName}
        author={author}
        limits={{ timeMs: timeLimitMs, memoryMb: kilobytesToMegabytes(memoryLimitKb) }}
      >
        {statement.trim() ? (
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
