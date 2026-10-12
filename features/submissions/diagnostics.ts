/*
 * Reading what the compiler and the program wrote, for the summaries above the raw text on the review pages.
 * Everything here is a best effort on GCC, Clang and Python output: when nothing is recognised the page shows
 * the raw text only, which is always there.
 */

export interface CompilerMessage {
  level: 'error' | 'warning';
  line: number;
  column?: number;
  text: string;
}

const COMPILER_LINE = /^[^\s:][^:]*:(\d+):(?:(\d+):)?\s+(fatal error|error|warning):\s+(.*)$/;

/** The errors and warnings in a GCC or Clang message ("main.cpp:15:23: error: ..."), in the order they were printed. */
export function parseCompilerMessages(output: string): CompilerMessage[] {
  const found: CompilerMessage[] = [];
  for (const raw of output.split('\n')) {
    const match = COMPILER_LINE.exec(raw.trimEnd());
    if (!match) continue;
    found.push({
      level: match[3] === 'warning' ? 'warning' : 'error',
      line: Number(match[1]),
      column: match[2] ? Number(match[2]) : undefined,
      text: match[4]!,
    });
  }
  return found;
}

const SIGNALS: Record<number, { name: string; meaning: string }> = {
  4: { name: 'SIGILL', meaning: 'an illegal instruction' },
  6: { name: 'SIGABRT', meaning: 'an abort (the program or its runtime gave up)' },
  7: { name: 'SIGBUS', meaning: 'a bus error (invalid memory access)' },
  8: { name: 'SIGFPE', meaning: 'an arithmetic error such as division by zero' },
  9: { name: 'SIGKILL', meaning: 'being killed by the judge' },
  11: { name: 'SIGSEGV', meaning: 'a segmentation fault (invalid memory access)' },
  15: { name: 'SIGTERM', meaning: 'being asked to stop' },
  24: { name: 'SIGXCPU', meaning: 'running out of CPU time' },
  25: { name: 'SIGXFSZ', meaning: 'writing too large a file' },
};

export function signalName(signal: number): string {
  return SIGNALS[signal]?.name ?? `signal ${signal}`;
}

export interface RuntimeSummary {
  /** One sentence for the top of the summary. */
  headline: string;
  /** The reason the program or its runtime gave, when stderr says. */
  cause?: string;
  /** "SIGABRT (6) · exit code 134". */
  status?: string;
}

/** What stopped the program, from its exit code, its signal and the end of its standard error. */
export function summariseRuntimeError(stderr: string, exitCode: number | null, signal: number | null): RuntimeSummary {
  const lines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const status =
    signal !== null
      ? `${signalName(signal)} (${signal})${exitCode !== null ? ` · exit code ${exitCode}` : ''}`
      : exitCode !== null
        ? `exit code ${exitCode}`
        : undefined;

  const thrown = /terminate called after throwing an instance of '([^']+)'/.exec(stderr);
  if (thrown) {
    const what = /what\(\):\s*(.*)/.exec(stderr);
    return { headline: `The program stopped on an uncaught exception: ${thrown[1]}`, cause: what?.[1], status };
  }
  // Python ends a traceback with "ErrorName: message".
  const last = lines.at(-1);
  if (stderr.includes('Traceback (most recent call last)') && last) {
    const name = /^([A-Za-z_][\w.]*)(?::\s*(.*))?$/.exec(last);
    if (name) {
      return {
        headline: `The program stopped on an uncaught exception: ${name[1]}`,
        cause: name[2] || undefined,
        status,
      };
    }
  }
  if (signal !== null && SIGNALS[signal]) {
    return { headline: `The program stopped after ${SIGNALS[signal]!.meaning}.`, cause: undefined, status };
  }
  if (exitCode !== null && exitCode !== 0) {
    return { headline: `The program ended with a non-zero exit code (${exitCode}).`, cause: last, status };
  }
  return { headline: 'The program stopped before it finished.', cause: last, status };
}

/**
 * How much of the expected output a program printed before it stopped:
 * "2 of 4 expected lines were printed. Both match." / "... 1 of them differs."
 */
export function describeOutputBeforeStop(expected: string[], printed: string[]): string {
  const trim = (line: string) => line.replace(/[ \t\r]+$/, '');
  const count = printed.length;
  if (count === 0)
    return `Nothing was printed. ${expected.length} ${expected.length === 1 ? 'line was' : 'lines were'} expected.`;
  const differing = printed.filter((line, index) => trim(line) !== trim(expected[index] ?? '')).length;
  const lead = `${count} of ${expected.length} expected ${expected.length === 1 ? 'line was' : 'lines were'} printed.`;
  if (differing === 0) return `${lead} ${count === 1 ? 'It matches.' : 'All of them match.'}`;
  return `${lead} ${differing} of them ${differing === 1 ? 'differs' : 'differ'}.`;
}

/** A file name for a download or the Code tab. */
export function sourceFileName(language: 'c' | 'cpp' | 'python'): string {
  return language === 'python' ? 'main.py' : language === 'c' ? 'main.c' : 'main.cpp';
}
