'use client';

import Link from 'next/link';
import { Code, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/format';
import { parseCompilerMessages, type CompilerMessage } from '../../diagnostics';
import { CopyIconButton } from './text-lines';

const AROUND = 3;

/** The lines of the code around the first error, with the lines the compiler complained about marked. */
function Snippet({
  source,
  messages,
  fileName,
  codeHref,
}: {
  source: string;
  messages: CompilerMessage[];
  fileName: string;
  codeHref?: string;
}) {
  const lines = source.split('\n');
  const first = messages.find((message) => message.level === 'error') ?? messages[0]!;
  const from = Math.max(1, first.line - AROUND);
  const to = Math.min(lines.length, first.line + AROUND);
  const level = (line: number) =>
    messages.some((m) => m.line === line && m.level === 'error')
      ? 'error'
      : messages.some((m) => m.line === line)
        ? 'warning'
        : null;
  return (
    <section
      id="snippet"
      aria-label="Code around the first error"
      className="border-border bg-surface overflow-hidden rounded-lg border"
    >
      <div className="vd-io__bar">
        <span className="vd-io__title">
          {fileName} · lines {from}–{to}
        </span>
        {codeHref && (
          <Link href={codeHref} className="vd-link text-small pr-2">
            Open full code
          </Link>
        )}
      </div>
      <ol className="cd-lines m-0">
        {lines.slice(from - 1, to).map((text, index) => {
          const number = from + index;
          const mark = level(number);
          return (
            <li
              key={number}
              className={cn('cd-line', mark === 'error' && 'bg-danger-soft', mark === 'warning' && 'bg-warning-soft')}
            >
              <span className="cd-no" aria-hidden>
                {number}
              </span>
              <span className="cd-gut" aria-hidden>
                {mark === 'error' ? '✕' : mark === 'warning' ? '!' : ''}
              </span>
              <code>{text}</code>
              {mark && <span className="vd-sr"> ({mark === 'error' ? 'error' : 'warning'} here)</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * What the compiler said: a count and one row per error or warning (line, column, text), the code around the first
 * error, and the raw output underneath. When the output is not in a format we can read, only the raw output shows.
 */
export function CompilerPanel({
  output,
  source,
  fileName,
  codeHref,
}: {
  output: string | null;
  source: string;
  fileName: string;
  /** Where the whole code is read (the Code tab). */
  codeHref?: string;
}) {
  const text = output ?? '';
  if (text.trim() === '') {
    return <p className="text-text-muted">The compiler printed nothing for this submission.</p>;
  }
  const messages = parseCompilerMessages(text);
  const errors = messages.filter((message) => message.level === 'error').length;
  const warnings = messages.length - errors;
  const rawLines = text.replace(/\n$/, '').split('\n').length;
  return (
    <div className="flex flex-col gap-4">
      {messages.length > 0 && (
        <section aria-label="Compilation summary" className="bg-verdict-ce-soft flex flex-col gap-3 rounded-md p-4">
          <p className="text-verdict-ce flex items-center gap-2 font-semibold">
            <Code className="size-4" strokeWidth={1.75} aria-hidden />
            {errors > 0
              ? `The code did not compile: ${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}. No testcases were run.`
              : `The code compiled with ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}.`}
          </p>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {messages.map((message, index) => (
              <li
                key={index}
                className="border-border bg-surface grid grid-cols-[72px_96px_1fr_auto] items-center gap-3 rounded-md border px-3 py-2 max-sm:grid-cols-[72px_1fr]"
              >
                <Badge tone={message.level === 'error' ? 'danger' : 'warning'}>
                  {message.level === 'error' ? 'Error' : 'Warning'}
                </Badge>
                <span className="vd-mono">
                  line {formatCount(message.line)}
                  {message.column ? `:${message.column}` : ''}
                </span>
                <span>{message.text}</span>
                <a className="vd-link text-small" href="#snippet">
                  Show in code
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
      {messages.length > 0 && source !== '' && (
        <Snippet source={source} messages={messages} fileName={fileName} codeHref={codeHref} />
      )}
      <section aria-label="Compiler output" className="border-border bg-surface overflow-hidden rounded-md border">
        <div className="vd-io__bar">
          <span className="vd-io__title">
            Compiler output (raw) · {rawLines} {rawLines === 1 ? 'line' : 'lines'}
          </span>
          <CopyIconButton text={text} label="Copy compiler output" />
        </div>
        <pre className="vd-io__pre bg-surface-sunken m-0" tabIndex={0}>
          {text}
        </pre>
      </section>
      {messages.length === 0 && (
        <p className="text-small text-text-muted flex items-center gap-2">
          <TriangleAlert className="size-4" aria-hidden /> The output is not in a format we can summarise; read it as it
          is.
        </p>
      )}
    </div>
  );
}
