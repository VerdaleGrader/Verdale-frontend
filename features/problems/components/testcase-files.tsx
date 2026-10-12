'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FilePreview, PREVIEW_LINES } from '@/components/ui/file-preview';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { FileSource, FileWindow } from '../test-file-source';

/** View all loads this many lines at a time. */
export const WINDOW_LINES = 1000;

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; window: FileWindow };

/** The first 10 lines of one file, read when its row opens. Past 10 lines: View all and Open raw. */
export function FileDetail({
  source,
  name,
  size,
  onViewAll,
}: {
  source: FileSource | null;
  name: string;
  size: number;
  onViewAll: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    if (!source) return;
    source.window(1, PREVIEW_LINES).then(
      (window) => !cancelled && setLoaded({ status: 'ready', window }),
      (caught: unknown) => !cancelled && setLoaded({ status: 'error', message: errorMessage(caught) })
    );
    return () => {
      cancelled = true;
    };
  }, [source, attempt]);

  if (!source) {
    return (
      <p className="tc-sub">
        <span className="vd-mono">{name}</span> · {formatBytes(size)}. Core made this file and has not stored it with
        the testcase yet, so its text can be read after you save.
      </p>
    );
  }
  if (loaded.status === 'error') {
    return (
      <p role="alert" className="vd-hint vd-hint--error">
        Could not load {name}. {loaded.message}{' '}
        <button
          type="button"
          className="vd-linkbtn"
          onClick={() => {
            setLoaded({ status: 'loading' });
            setAttempt((current) => current + 1);
          }}
        >
          Try again
        </button>
      </p>
    );
  }
  if (loaded.status === 'loading') {
    return (
      <p role="status" className="tc-sub">
        Loading {name}…
      </p>
    );
  }
  return (
    <FilePreview
      name={name}
      text={loaded.window.lines.join('\n')}
      totalLines={loaded.window.totalLines}
      onViewAll={onViewAll}
      rawHref={source.rawHref}
    />
  );
}

export interface ViewAllTarget {
  label: string;
  sides: Array<{ side: 'input' | 'output'; name: string; title: string; source: FileSource | null }>;
  start: 'input' | 'output';
}

interface Pages {
  lines: string[];
  total: number;
  size: number;
  status: 'loading' | 'ready' | 'error';
  message?: string;
}

/** A wide window onto one file (and its sibling), 1,000 lines at a time. */
export function ViewAllDialog({ target, onClose }: { target: ViewAllTarget | null; onClose: () => void }) {
  return target ? <ViewAllContent target={target} onClose={onClose} /> : null;
}

function ViewAllContent({ target, onClose }: { target: ViewAllTarget; onClose: () => void }) {
  const [side, setSide] = useState(target.start);
  const [pages, setPages] = useState<Partial<Record<'input' | 'output', Pages>>>({});
  const current = target.sides.find((candidate) => candidate.side === side)!;
  const state = pages[side];

  async function load(which: 'input' | 'output', from: number) {
    const entry = target.sides.find((candidate) => candidate.side === which);
    if (!entry?.source) return;
    setPages((all) => ({
      ...all,
      [which]: { lines: [], total: 0, size: 0, ...all[which], status: 'loading' as const },
    }));
    try {
      const window = await entry.source.window(from, WINDOW_LINES);
      setPages((all) => ({
        ...all,
        [which]: {
          lines: [...(from === 1 ? [] : (all[which]?.lines ?? [])), ...window.lines],
          total: window.totalLines,
          size: window.sizeBytes,
          status: 'ready' as const,
        },
      }));
    } catch (caught) {
      setPages((all) => ({
        ...all,
        [which]: {
          lines: [],
          total: 0,
          size: 0,
          ...all[which],
          status: 'error' as const,
          message: errorMessage(caught),
        },
      }));
    }
  }

  useEffect(() => {
    if (!pages[side]) void load(side, 1);
    // Loads each side once, the first time it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  const shown = state?.lines.length ?? 0;
  const total = state?.total ?? 0;
  const first = shown === 0 ? 0 : 1;
  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={current.name}
      description={`${target.label} · ${current.title}${state?.status === 'ready' ? ` · ${total.toLocaleString('en-US')} ${total === 1 ? 'line' : 'lines'} · ${formatBytes(state.size)}` : ''}`}
      footer={
        <>
          {current.source?.rawHref && (
            <Button variant="ghost" asChild>
              <a href={current.source.rawHref} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                Open raw
                <span className="vd-sr"> (opens in a new tab)</span>
              </a>
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Tabs value={side} onValueChange={(next) => setSide(next as 'input' | 'output')}>
            <TabsList aria-label="File">
              {target.sides.map((entry) => (
                <TabsTrigger key={entry.side} value={entry.side}>
                  {entry.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {state?.status === 'ready' && (
            <span className="tc-sub mt-0 ml-auto">
              Lines {first}–{shown.toLocaleString('en-US')} of {total.toLocaleString('en-US')}
            </span>
          )}
        </div>
        {state?.status === 'error' ? (
          <p role="alert" className="vd-hint vd-hint--error">
            Could not load {current.name}. {state.message}{' '}
            <button type="button" className="vd-linkbtn" onClick={() => void load(side, shown + 1)}>
              Try again
            </button>
          </p>
        ) : !current.source ? (
          <p className="tc-sub">This file is not stored with the testcase yet. Its text can be read after you save.</p>
        ) : (
          <ol className="tc-lines" tabIndex={0} aria-label={`${current.name}, lines ${first} to ${shown} of ${total}`}>
            {state?.lines.map((line, index) => (
              <li key={index}>
                <span className="tc-lines__no" aria-hidden>
                  {index + 1}
                </span>
                <code>{line}</code>
              </li>
            ))}
            {state?.status === 'loading' && (
              <li role="status" className="vd-muted">
                Loading…
              </li>
            )}
            {state?.status === 'ready' && shown < total && (
              <li style={{ padding: '12px 12px 4px 84px' }}>
                <Button size="sm" variant="secondary" onClick={() => void load(side, shown + 1)}>
                  Load the next {Math.min(WINDOW_LINES, total - shown).toLocaleString('en-US')} lines
                </Button>
              </li>
            )}
          </ol>
        )}
        <p className="tc-sub">
          Long files load in pages so the browser stays fast.
          {current.source?.rawHref ? ' Open raw shows the whole file as plain text.' : ''}
        </p>
      </div>
    </Dialog>
  );
}
