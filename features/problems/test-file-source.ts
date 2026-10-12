import { problemsApi, testFileUrl, type ProblemTarget } from './api/problems.api';
import type { DraftTest, Side } from './test-drafts';

/** A window of lines of a testcase file, wherever the file lives (saved in Core, or chosen on this page). */
export interface FileWindow {
  lines: string[];
  /** 1-based number of the first line. */
  fromLine: number;
  toLine: number;
  totalLines: number;
  sizeBytes: number;
}

export interface FileSource {
  window: (fromLine: number, maxLines: number) => Promise<FileWindow>;
  /** The whole file as text; only a saved file has one. */
  rawHref?: string;
}

/** jsdom and old browsers lack Blob.text(). */
export function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(blob);
  });
}

export function textLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** A file or pasted text on this page: the lines come from memory. */
export function localSource(local: File | string): FileSource {
  let lines: Promise<string[]> | undefined;
  return {
    window: async (fromLine, maxLines) => {
      lines ??= (typeof local === 'string' ? Promise.resolve(local) : readText(local)).then(textLines);
      const all = await lines;
      const chosen = all.slice(fromLine - 1, fromLine - 1 + maxLines);
      return {
        lines: chosen,
        fromLine,
        toLine: fromLine + chosen.length - 1,
        totalLines: all.length,
        sizeBytes: typeof local === 'string' ? new Blob([local]).size : local.size,
      };
    },
  };
}

/** A file Core has: lines come from the slice endpoint. */
export function savedSource(target: ProblemTarget, testId: string, side: Side): FileSource {
  return {
    window: async (fromLine, maxLines) => {
      const slice = await problemsApi.testFileSlice(target, testId, side, fromLine, maxLines);
      return {
        lines: slice.lines,
        fromLine: slice.from_line,
        toLine: slice.to_line,
        totalLines: slice.total_lines,
        sizeBytes: slice.size_bytes,
      };
    },
    rawHref: testFileUrl(target, testId, side),
  };
}

/** Where to read one side of a row from, or null when nothing can be read yet (an output Generate made and Core has not saved). */
export function sourceOf(target: ProblemTarget, test: DraftTest, side: Side): FileSource | null {
  const file = side === 'input' ? test.input : test.output;
  if (!file) return null;
  if (file.local !== undefined) return localSource(file.local);
  const savedSha = side === 'input' ? test.baseline?.input_sha256 : test.baseline?.output_sha256;
  if (test.baseline && file.sha256 === savedSha) return savedSource(target, test.baseline.id, side);
  return null;
}
