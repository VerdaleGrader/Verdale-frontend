'use client';

import { ExternalLink, Maximize2 } from 'lucide-react';
import { Button } from './button';

/** How many lines a preview shows before View all and Open raw take over. */
export const PREVIEW_LINES = 10;

/**
 * The start of a text file, expanded inside a row: at most 10 lines. When there is more, the person can
 * View all in a larger window (`onViewAll`) or Open raw (`rawHref`: the whole file as text in a new tab).
 */
export function FilePreview({
  name,
  text,
  totalLines,
  onViewAll,
  rawHref,
}: {
  name: string;
  /** The text to preview; only its first 10 lines are drawn. */
  text: string;
  /** The real number of lines when `text` is only the start of the file. */
  totalLines?: number;
  onViewAll?: () => void;
  rawHref?: string;
}) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const total = totalLines ?? lines.length;
  const shown = lines.slice(0, PREVIEW_LINES);
  const more = total > shown.length;
  return (
    <figure className="vd-filepreview">
      <figcaption className="vd-filepreview__bar">
        <span className="vd-mono">{name}</span>
        <span className="vd-muted">
          {more
            ? `First ${shown.length} of ${total.toLocaleString('en-US')} lines`
            : `${total} ${total === 1 ? 'line' : 'lines'}`}
        </span>
      </figcaption>
      <pre className="vd-filepreview__text" tabIndex={0} aria-label={`Preview of ${name}`}>
        {shown.length === 0 ? '(empty file)' : shown.join('\n')}
      </pre>
      {more && (
        <div className="vd-filepreview__more">
          {onViewAll && (
            <Button size="sm" variant="ghost" onClick={onViewAll}>
              <Maximize2 aria-hidden />
              View all
            </Button>
          )}
          {rawHref && (
            <Button size="sm" variant="ghost" asChild>
              <a href={rawHref} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                Open raw
                <span className="vd-sr"> (new tab)</span>
              </a>
            </Button>
          )}
        </div>
      )}
    </figure>
  );
}
