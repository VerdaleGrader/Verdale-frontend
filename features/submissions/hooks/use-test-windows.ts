'use client';

import { useCallback, useState } from 'react';
import { useApiQuery } from '@/lib/use-api-query';
import { reviewApi, WINDOW_LINES, type SubmissionTestDetail } from '../api/review.api';

export type PartName = 'input' | 'expected' | 'output' | 'stderr';

/** What has been loaded of one file of a test: the lines so far and how many there are in all. */
export interface LoadedPart {
  lines: string[];
  totalLines: number;
  sizeBytes: number;
  /** What the program printed was shortened by Judge (it keeps the start only). */
  cut: boolean;
  /** The file could not be read (never stored, or removed). */
  unavailable: boolean;
  /** A line was longer than Core sends and was cut. */
  lineTruncated: boolean;
  /** Every line is loaded. */
  complete: boolean;
}

export type TestDetail = Omit<SubmissionTestDetail, PartName> & Record<PartName, LoadedPart | null>;

type Extra = Partial<Record<PartName, string[]>>;

const loaded = (part: SubmissionTestDetail[PartName], extra: string[] = []): LoadedPart | null => {
  if (!part) return null;
  const lines = [...part.lines, ...extra];
  return {
    lines,
    totalLines: part.total_lines,
    sizeBytes: part.size_bytes,
    cut: 'cut' in part ? part.cut : false,
    unavailable: 'unavailable' in part ? Boolean(part.unavailable) : false,
    lineTruncated: part.line_truncated,
    complete: part.from_line + part.lines.length - 1 + extra.length >= part.total_lines,
  };
};

/**
 * One test of a submission as windows of lines (input, expected output, the program's output, standard error), the
 * first window at once and the following ones on request. Staff only: Core answers 404 to everyone else.
 */
type Windows =
  | {
      status: 'loading' | 'error';
      error: Error | undefined;
      reload: () => void;
      detail: undefined;
      loadMore: (names: PartName[]) => Promise<void>;
      loading: PartName[];
      moreError: null;
    }
  | {
      status: 'success';
      error: undefined;
      reload: () => void;
      detail: TestDetail;
      loadMore: (names: PartName[]) => Promise<void>;
      loading: PartName[];
      moreError: Error | null;
    };

export function useTestWindows(submissionId: string, position: number): Windows {
  const key = `${submissionId}/${position}`;
  const first = useApiQuery(() => reviewApi.test(submissionId, position, { maxLines: WINDOW_LINES }), `test-${key}`);
  const [more, setMore] = useState<{ key: string; lines: Extra; loading: PartName[]; error: Error | null }>({
    key,
    lines: {},
    loading: [],
    error: null,
  });
  // Lines loaded for another test are not ours.
  const mine = more.key === key ? more : { key, lines: {} as Extra, loading: [] as PartName[], error: null };

  const loadMore = useCallback(
    async (names: PartName[]) => {
      if (first.status !== 'success') return;
      setMore((current) => ({
        ...(current.key === key ? current : { key, lines: {}, loading: [], error: null }),
        loading: names,
        error: null,
      }));
      try {
        const results = await Promise.all(
          names.map(async (name) => {
            const base = first.data[name];
            const have = (base?.lines.length ?? 0) + (mine.lines[name]?.length ?? 0);
            const window = await reviewApi.test(submissionId, position, {
              part: name,
              fromLine: have + 1,
              maxLines: WINDOW_LINES,
            });
            return [name, window[name]?.lines ?? []] as const;
          })
        );
        setMore((current) => {
          const base = current.key === key ? current : { key, lines: {} as Extra, loading: [], error: null };
          const lines = { ...base.lines };
          for (const [name, extra] of results) lines[name] = [...(lines[name] ?? []), ...extra];
          return { ...base, lines, loading: [] };
        });
      } catch (caught) {
        setMore((current) => ({
          ...current,
          loading: [],
          error: caught instanceof Error ? caught : new Error(String(caught)),
        }));
      }
    },
    [first.status, first.data, key, mine.lines, submissionId, position]
  );

  if (first.status !== 'success') {
    return {
      status: first.status,
      error: first.error,
      reload: first.reload,
      detail: undefined,
      loadMore,
      loading: [],
      moreError: null,
    };
  }
  const detail: TestDetail = {
    ...first.data,
    input: loaded(first.data.input, mine.lines.input),
    expected: loaded(first.data.expected, mine.lines.expected),
    output: loaded(first.data.output, mine.lines.output),
    stderr: loaded(first.data.stderr, mine.lines.stderr),
  };
  return {
    status: 'success',
    error: undefined,
    reload: first.reload,
    detail,
    loadMore,
    loading: mine.loading,
    moreError: mine.error,
  };
}
