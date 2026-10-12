'use client';

import { Lock } from 'lucide-react';
import { CodeEditor } from '@/components/code/code-editor';
import { DiffView } from '@/components/grader/diff-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { Skeleton } from '@/components/states/states';
import { LANGUAGE_LABELS } from '@/features/problems/types';
import { formatBytes, formatCount, timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { VERDICTS } from '@/components/grader/verdict';
import type { SpaceSubmissionRow } from '../../api/review.api';
import { submissionsApi, type Submission } from '../../api/submissions.api';
import { sourceFileName } from '../../diagnostics';
import { displayVerdict } from '../../verdicts';
import { shortId } from './review-parts';
import { CopyIconButton } from './text-lines';

export const NO_COMPARE = 'none';

function download(source: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** The other submission's code beside this one, line by line and character by character. */
function CompareSource({
  source,
  otherId,
  otherLabel,
  thisLabel,
}: {
  source: string;
  otherId: string;
  otherLabel: string;
  thisLabel: string;
}) {
  const other = useApiQuery(() => submissionsApi.get(otherId), `compare-${otherId}`);
  if (other.status === 'loading') {
    return (
      <div className="border-border bg-surface flex flex-col gap-2 rounded-md border p-4" aria-busy="true">
        <Skeleton width="50%" />
        <Skeleton width="70%" />
      </div>
    );
  }
  if (other.status === 'error') {
    return (
      <div role="alert" className="border-border bg-surface flex flex-col items-start gap-2 rounded-md border p-4">
        <p className="font-medium">The other submission’s code could not be loaded.</p>
        <Button size="sm" onClick={other.reload}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <DiffView
      expected={other.data.source ?? ''}
      actual={source}
      expectedLabel={otherLabel}
      actualLabel={thisLabel}
      actualName="this code"
      defaultShowWhitespace={false}
      copyable
      foldLongOutput
    />
  );
}

/**
 * The submitted code, read-only in the Verdale Monaco theme, with Copy and Download, and a way to compare it
 * with another submission of the same person on the same problem (`compare` in the URL).
 */
export function CodePanel({
  submission,
  siblings,
  compareId,
  onCompare,
}: {
  submission: Submission;
  siblings: SpaceSubmissionRow[];
  compareId: string;
  onCompare: (id: string) => void;
}) {
  const source = submission.source ?? '';
  const lines = source === '' ? 0 : source.replace(/\n$/, '').split('\n').length;
  const bytes = new Blob([source]).size;
  const fileName = sourceFileName(submission.language);
  const others = siblings.filter((row) => row.id !== submission.id);
  const compareWith = others.find((row) => row.id === compareId);
  const options = [
    { value: NO_COMPARE, label: 'Nothing' },
    ...others.map((row) => ({
      value: row.id,
      label: `${shortId(row.id)} · ${VERDICTS[displayVerdict(row)].label} · ${timeAgo(row.created_at)}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Source code" className="border-border bg-surface overflow-hidden rounded-lg border">
        <div className="border-border flex h-11 flex-wrap items-center justify-between gap-3 border-b pr-2 pl-4">
          <div className="text-small text-text-muted flex flex-wrap items-center gap-3">
            <span className="vd-mono text-text">{fileName}</span>
            <span>{LANGUAGE_LABELS[submission.language]}</span>
            <span aria-hidden>·</span>
            <span>
              {formatCount(lines)} {lines === 1 ? 'line' : 'lines'} · {formatBytes(bytes)}
            </span>
            <Badge icon={Lock}>Read only</Badge>
          </div>
          <div className="flex gap-1">
            <CopyIconButton text={source} label="Copy code" />
            <Button size="sm" variant="ghost" onClick={() => download(source, fileName)}>
              Download
            </Button>
          </div>
        </div>
        {source === '' ? (
          <p className="text-text-muted p-4">The code of this submission is not available.</p>
        ) : (
          <CodeEditor
            value={source}
            onChange={() => undefined}
            language={submission.language}
            label={`Code of submission ${shortId(submission.id)}`}
            readOnly
            height={Math.min(640, Math.max(160, lines * 22 + 24))}
          />
        )}
      </section>

      {others.length > 0 && (
        <section aria-label="Compare code" className="flex flex-col gap-3">
          <Dropdown
            label="Compare with another submission of this person"
            className="max-w-[420px]"
            options={options}
            value={compareWith ? compareId : NO_COMPARE}
            onValueChange={(next) => onCompare(next === NO_COMPARE ? '' : next)}
          />
          {compareWith && (
            <CompareSource
              source={source}
              otherId={compareWith.id}
              otherLabel={`${shortId(compareWith.id)} · ${timeAgo(compareWith.created_at)}`}
              thisLabel={`${shortId(submission.id)} (this one)`}
            />
          )}
        </section>
      )}
    </div>
  );
}
