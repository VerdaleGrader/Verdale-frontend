'use client';

import { useEffect, useState } from 'react';
import { Ban, Clock, EyeOff, Layers, Wrench, Zap } from 'lucide-react';
import { DiffView } from '@/components/grader/diff-view';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/states/states';
import { formatBytes, formatCount, formatMemory, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { reviewApi, WINDOW_LINES } from '../../api/review.api';
import type { Submission, SubmissionTestResult } from '../../api/submissions.api';
import { describeOutputBeforeStop, signalName, summariseRuntimeError } from '../../diagnostics';
import { useTestWindows, type LoadedPart, type PartName, type TestDetail } from '../../hooks/use-test-windows';
import { CopyIconButton, LinesPane } from './text-lines';

/** Download a whole file of a test: every window in turn, joined. Output is stored only in part; that is all there is. */
async function downloadPart(submissionId: string, position: number, name: PartName, fileName: string) {
  const lines: string[] = [];
  for (;;) {
    const window = await reviewApi.test(submissionId, position, {
      part: name,
      fromLine: lines.length + 1,
      maxLines: WINDOW_LINES,
    });
    const part = window[name];
    if (!part || part.lines.length === 0) break;
    lines.push(...part.lines);
    if (lines.length >= part.total_lines) break;
  }
  const url = URL.createObjectURL(
    new Blob([lines.join('\n') + (lines.length > 0 ? '\n' : '')], { type: 'text/plain' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** What the judge printed beside the verdict: "48 ms · 3.4 MB · exit code 0". */
function runFigures(detail: TestDetail): string {
  const parts = [formatTime(detail.time_ms), formatMemory(detail.memory_kb)];
  if (detail.signal !== null) parts.push(`exit code ${detail.exit_code ?? '—'} (${signalName(detail.signal)})`);
  else if (detail.exit_code !== null) parts.push(`exit code ${detail.exit_code}`);
  else if (['TLE', 'MLE', 'OLE'].includes(detail.verdict)) parts.push('stopped by the judge');
  return parts.join(' · ');
}

const STOPPED_BY = {
  TLE: {
    icon: Clock,
    text: 'The program ran longer than the time limit and was stopped.',
    tone: 'bg-verdict-tle-soft text-verdict-tle',
  },
  MLE: {
    icon: Layers,
    text: 'The program used more memory than the limit and was stopped.',
    tone: 'bg-verdict-mle-soft text-verdict-mle',
  },
  OLE: {
    icon: Ban,
    text: 'The program printed more output than allowed and was stopped.',
    tone: 'bg-verdict-ole-soft text-verdict-ole',
  },
} as const;

/**
 * The two sides to compare, cut to what is loaded on both so a missing line is never just an unloaded one.
 * Judge keeps only the start of the output: when that is all there is, its last (possibly half) line and
 * everything expected after it are left out of the comparison.
 */
export function comparison(expected: LoadedPart, output: LoadedPart) {
  const stored = output.cut && output.complete;
  const printed = stored ? output.lines.slice(0, -1) : output.lines;
  let limit = Infinity;
  if (!expected.complete) limit = Math.min(limit, expected.lines.length);
  if (!output.complete) limit = Math.min(limit, printed.length);
  if (stored && !(expected.complete && expected.lines.length <= printed.length))
    limit = Math.min(limit, printed.length);
  const cut = (lines: string[]) => (limit === Infinity ? lines : lines.slice(0, limit));
  const more: PartName[] = [];
  if (!expected.complete) more.push('expected');
  if (!output.complete) more.push('output');
  return {
    expected: cut(expected.lines).join('\n'),
    actual: cut(printed).join('\n'),
    compared: limit === Infinity ? null : limit,
    more,
    stored,
  };
}

/** Hidden testcases are marked with the closed eye, the same as in the list on the left. */
function SampleBadge({ sample }: { sample: boolean }) {
  return sample ? <Badge>Sample</Badge> : <Badge icon={EyeOff}>Hidden</Badge>;
}

function FileError({ title, onRetry, download }: { title: string; onRetry: () => void; download?: React.ReactNode }) {
  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-md border p-4" role="alert">
      <p className="font-medium">{title}</p>
      <p className="text-text-muted">
        The verdict above is still correct; only the preview failed. Try again, or download the file.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
        {download}
      </div>
    </div>
  );
}

/** One testcase of a submission: the verdict and figures, what went wrong and why, input, output beside expected, stderr. */
export function TestcasePanel({
  submission,
  result,
  authorName,
}: {
  submission: Submission;
  result: SubmissionTestResult;
  authorName: string;
}) {
  const { position } = result;
  const heading = `Testcase ${position}`;
  if (result.verdict === 'SKIPPED') {
    return (
      <section aria-label={heading} className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
        <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-md border px-4 py-3">
          <h3 className="text-h3">{heading}</h3>
          <SampleBadge sample={result.is_sample} />
          <VerdictBadge verdict="SKIPPED" />
        </div>
        <p className="text-text-muted">Not run: judging stops at the first failed testcase.</p>
      </section>
    );
  }
  return (
    <LoadedPanel key={`${submission.id}-${position}`} submission={submission} result={result} authorName={authorName} />
  );
}

function LoadedPanel({
  submission,
  result,
  authorName,
}: {
  submission: Submission;
  result: SubmissionTestResult;
  authorName: string;
}) {
  const { position } = result;
  const heading = `Testcase ${position}`;
  const windows = useTestWindows(submission.id, position);
  const [downloading, setDownloading] = useState<PartName | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const download = async (name: PartName, fileName: string) => {
    setDownloading(name);
    setDownloadFailed(false);
    try {
      await downloadPart(submission.id, position, name, fileName);
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(null);
    }
  };
  // When the expected output is all here and the output has not gone past it yet, fetch more of the output so that
  // extra lines show instead of a comparison that looks like a match.
  const needsMoreOutput =
    windows.status === 'success' &&
    Boolean(windows.detail.expected?.complete) &&
    Boolean(windows.detail.output && !windows.detail.output.complete) &&
    (windows.detail.output?.lines.length ?? 0) <= (windows.detail.expected?.lines.length ?? 0);
  const { loadMore, loading: loadingParts, moreError } = windows;
  useEffect(() => {
    if (needsMoreOutput && loadingParts.length === 0 && !moreError) void loadMore(['output']);
  }, [needsMoreOutput, loadingParts.length, moreError, loadMore]);
  const prefix = `testcase-${position}`;
  const downloadButton = (name: PartName, label: string, file: string) => (
    <Button key={name} size="sm" variant="ghost" disabled={downloading !== null} onClick={() => download(name, file)}>
      {downloading === name ? 'Preparing…' : label}
    </Button>
  );

  if (windows.status !== 'success') {
    if (windows.status === 'loading') {
      return (
        <section aria-label={heading} aria-busy="true" className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
          <div className="border-border bg-surface flex items-center gap-3 rounded-md border px-4 py-3">
            <h3 className="text-h3">{heading}</h3>
            <VerdictBadge verdict={result.verdict} />
          </div>
          <div className="border-border bg-surface flex flex-col gap-3 rounded-md border p-4">
            <Skeleton width="60%" />
            <Skeleton width="80%" />
            <Skeleton width="40%" />
          </div>
        </section>
      );
    }
    return (
      <section aria-label={heading} className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
        <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-md border px-4 py-3">
          <h3 className="text-h3">{heading}</h3>
          <SampleBadge sample={result.is_sample} />
          <VerdictBadge verdict={result.verdict} />
          <span className="vd-mono text-text-muted">
            {formatTime(result.time_ms)} · {formatMemory(result.memory_kb)}
          </span>
        </div>
        <FileError title={`${heading} could not be loaded.`} onRetry={windows.reload} />
      </section>
    );
  }

  const detail = windows.detail;
  const { input, expected, output, stderr } = detail;
  const stderrText = stderr?.lines.join('\n') ?? '';
  const stoppedBy = STOPPED_BY[detail.verdict as keyof typeof STOPPED_BY];
  const runtime = detail.verdict === 'RE' ? summariseRuntimeError(stderrText, detail.exit_code, detail.signal) : null;
  const cmp = expected && output && !expected.unavailable ? comparison(expected, output) : null;
  const inputPane =
    input && !input.unavailable ? (
      <LinesPane
        title="Input"
        lines={input.lines}
        totalLines={input.totalLines}
        sizeBytes={input.sizeBytes}
        truncatedLines={input.lineTruncated}
        loadingMore={windows.loading.includes('input')}
        onLoadMore={() => windows.loadMore(['input'])}
      />
    ) : (
      <p className="text-text-muted">The input of this testcase could not be read.</p>
    );

  return (
    <section aria-label={heading} className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-h3">{heading}</h3>
          <SampleBadge sample={detail.is_sample} />
          <VerdictBadge verdict={detail.verdict} />
          <span className="vd-mono text-text-muted">{runFigures(detail)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {input && !input.unavailable && downloadButton('input', 'Download input', `${prefix}-input.txt`)}
          {detail.verdict === 'RE' && stderr && downloadButton('stderr', 'Download stderr', `${prefix}-stderr.txt`)}
          {detail.verdict !== 'RE' &&
            output &&
            downloadButton(
              'output',
              output.cut ? 'Download output (stored part)' : 'Download output',
              `${prefix}-output.txt`
            )}
          {detail.verdict !== 'RE' &&
            expected &&
            !expected.unavailable &&
            downloadButton('expected', 'Download expected', `${prefix}-expected.txt`)}
        </div>
      </div>
      {downloadFailed && (
        <p role="alert" className="text-small text-danger">
          The file could not be downloaded. Try again.
        </p>
      )}
      {windows.moreError && (
        <p role="alert" className="text-small text-danger">
          The next lines could not be loaded. Try again.
        </p>
      )}

      {detail.verdict === 'ISE' && (
        <div className="bg-verdict-ise-soft flex flex-col gap-2 rounded-md p-4 outline-1 -outline-offset-1 outline-[var(--verdict-ise)] outline-dashed">
          <p className="text-verdict-ise flex items-center gap-2 font-semibold">
            <Wrench className="size-4" strokeWidth={1.75} aria-hidden />
            The judge failed while running testcase {position}.
          </p>
          <p>This is not the solver’s fault and does not count as a failed attempt.</p>
          {submission.error_code && (
            <p className="text-small text-text-muted">
              Judge reference: <span className="vd-mono">{submission.error_code}</span>
            </p>
          )}
        </div>
      )}

      {runtime && (
        <section aria-label="Error summary" className="bg-verdict-re-soft flex flex-col gap-2 rounded-md p-4">
          <p className="text-verdict-re flex items-center gap-2 font-semibold">
            <Zap className="size-4" strokeWidth={1.75} aria-hidden />
            {runtime.headline}
          </p>
          <dl className="text-small grid grid-cols-[160px_1fr] gap-x-4 gap-y-1">
            {runtime.cause && (
              <>
                <dt className="text-text-muted">Cause</dt>
                <dd>{runtime.cause}</dd>
              </>
            )}
            {runtime.status && (
              <>
                <dt className="text-text-muted">Signal and exit code</dt>
                <dd className="vd-mono">{runtime.status}</dd>
              </>
            )}
            {expected && output && !expected.unavailable && (
              <>
                <dt className="text-text-muted">Output before stop</dt>
                <dd>{describeOutputBeforeStop(expected.lines, output.lines)}</dd>
              </>
            )}
            <dt className="text-text-muted">Where</dt>
            <dd className="text-text-muted">No line number: the judge does not build with debug symbols.</dd>
          </dl>
        </section>
      )}

      {stoppedBy && (
        <div role="status" className={cn('flex flex-col gap-1 rounded-md px-4 py-3', stoppedBy.tone.split(' ')[0])}>
          <p className={cn('flex items-center gap-2 font-medium', stoppedBy.tone.split(' ')[1])}>
            <stoppedBy.icon className="size-4" strokeWidth={1.75} aria-hidden />
            {stoppedBy.text}
          </p>
          {output?.cut && (
            <p className="text-small text-text-muted">
              Only the first {formatBytes(output.sizeBytes)} of the output ({formatCount(output.totalLines)} lines) is
              stored, so the view below ends there.
            </p>
          )}
        </div>
      )}

      {runtime && stderr && stderrText && (
        <section aria-label="Standard error" className="border-border bg-surface overflow-hidden rounded-md border">
          <div className="vd-io__bar">
            <span className="vd-io__title">
              Standard error (raw) · {formatCount(stderr.totalLines)} {stderr.totalLines === 1 ? 'line' : 'lines'} ·{' '}
              {formatBytes(stderr.sizeBytes)}
              {stderr.cut ? ' (start only)' : ''}
            </span>
            <CopyIconButton text={stderrText} label="Copy standard error" />
          </div>
          <pre className="vd-io__pre bg-surface-sunken m-0" tabIndex={0}>
            {stderrText}
          </pre>
        </section>
      )}

      {!cmp &&
        detail.verdict !== 'ISE' &&
        (!expected || expected.unavailable ? (
          <FileError title={`Expected output for testcase ${position} could not be loaded.`} onRetry={windows.reload} />
        ) : (
          <p className="text-text-muted">No output was recorded for this testcase.</p>
        ))}

      {cmp ? (
        <DiffView
          expected={cmp.expected}
          actual={cmp.actual}
          expectedLabel="Expected output"
          actualLabel={runtime ? 'Output before the stop' : `Output (${authorName})`}
          actualName="the output"
          copyable
          outputFirst
          plain={Boolean(runtime)}
          missingText={runtime ? (line) => `(stopped before line ${line})` : undefined}
          goToLine={Math.max(expected!.totalLines, output!.totalLines) > 100}
          expectedTotal={expected!.totalLines}
          actualTotal={output!.totalLines}
          between={<div className="flex flex-col gap-2">{inputPane}</div>}
        />
      ) : (
        <div className="flex flex-col gap-2">{inputPane}</div>
      )}

      {cmp && cmp.more.length > 0 && (
        <p className="text-small text-text-muted border-border bg-surface flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
          Comparing the first {formatCount(cmp.compared ?? 0)} lines. The files are longer:{' '}
          {formatCount(expected!.totalLines)} expected, {formatCount(output!.totalLines)} printed.
          <Button size="sm" disabled={windows.loading.length > 0} onClick={() => windows.loadMore(cmp.more)}>
            {windows.loading.length > 0 ? 'Loading…' : `Load the next ${formatCount(WINDOW_LINES)} lines`}
          </Button>
        </p>
      )}
      {cmp?.stored && (
        <p className="text-small text-text-muted">
          Judge stores only the start of the output (up to 64 KiB); the rest, and its last partial line, is not
          compared.
        </p>
      )}

      {!runtime && (
        <details className="border-border bg-surface rounded-md border" open={Boolean(stderrText)}>
          <summary className="cursor-pointer px-4 py-2.5 font-medium">
            Standard error{' '}
            <span className="text-text-muted font-normal">
              · {stderrText ? `${formatCount(stderr!.totalLines)} lines` : stderr ? 'empty' : 'not recorded'}
            </span>
          </summary>
          {stderrText && (
            <pre className="vd-io__pre bg-surface-sunken m-0" tabIndex={0}>
              {stderrText}
            </pre>
          )}
        </details>
      )}
    </section>
  );
}
