'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes, formatCount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WINDOW_LINES } from '../../api/review.api';

/** A line with its whitespace made visible: · space, → tab, ↵ line end. */
export function VisibleLine({ text, showWhitespace }: { text: string; showWhitespace: boolean }) {
  if (!showWhitespace) return <code>{text}</code>;
  return (
    <code>
      {text.split(/([ \t])/).map((part, index) =>
        part === ' ' || part === '\t' ? (
          <span key={index} className="cd-ws">
            {part === ' ' ? '·' : '→'}
          </span>
        ) : (
          part
        )
      )}
      <span className="cd-ws">↵</span>
    </code>
  );
}

/** Copy to the clipboard; a blocked clipboard is not an error worth a message, the text is selectable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyIconButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className="vd-iconbtn"
        aria-label={label}
        onClick={async () => {
          setCopied(await copyText(text));
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      <span className="vd-sr" role="status">
        {copied ? 'Copied' : ''}
      </span>
    </>
  );
}

/**
 * Part of a file as numbered lines with visible whitespace (the Input of a testcase). Shows what was loaded; the
 * footer says how much more there is and loads the next window.
 */
export function LinesPane({
  title,
  lines,
  totalLines,
  sizeBytes,
  showWhitespace = true,
  truncatedLines,
  onLoadMore,
  loadingMore,
}: {
  title: string;
  lines: string[];
  totalLines: number;
  sizeBytes: number;
  showWhitespace?: boolean;
  /** A line was longer than Core sends and was cut. */
  truncatedLines?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const rest = totalLines - lines.length;
  return (
    <div className="vd-io__pane bg-surface">
      <div className="vd-io__bar">
        <span className="vd-io__title">
          {title} · {formatCount(totalLines)} {totalLines === 1 ? 'line' : 'lines'} · {formatBytes(sizeBytes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <CopyIconButton
            text={lines.join('\n') + (lines.length > 0 ? '\n' : '')}
            label={`Copy ${title.toLowerCase()}`}
          />
          <Button size="sm" variant="ghost" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}>
            {collapsed ? 'Expand' : 'Collapse'}
          </Button>
        </span>
      </div>
      {!collapsed && (
        <>
          <ol className="cd-lines bg-surface-sunken" aria-label={title}>
            {lines.map((line, index) => (
              <li key={index} className="cd-line">
                <span className="cd-no" aria-hidden>
                  {formatCount(index + 1)}
                </span>
                <span className="cd-gut" aria-hidden />
                <VisibleLine text={line} showWhitespace={showWhitespace} />
              </li>
            ))}
            {lines.length === 0 && (
              <li className="cd-line is-missing">
                <span className="cd-no" aria-hidden />
                <span className="cd-gut" aria-hidden />
                <code>(empty)</code>
              </li>
            )}
          </ol>
          {(rest > 0 || truncatedLines) && (
            <p className="text-small text-text-muted border-border flex flex-wrap items-center gap-2 border-t px-3 py-2">
              {rest > 0 && (
                <>
                  Showing the first {formatCount(lines.length)} of {formatCount(totalLines)} lines.
                  <Button size="sm" onClick={onLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : `Show ${formatCount(Math.min(WINDOW_LINES, rest))} more`}
                  </Button>
                </>
              )}
              {truncatedLines && <span>Lines longer than 10,000 characters are cut.</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Muted({ className, ...props }: React.ComponentProps<'span'>) {
  return <span className={cn('text-text-muted', className)} {...props} />;
}
