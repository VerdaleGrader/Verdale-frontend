'use client';

import * as React from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

/*
 * Output beside expected output, the way the judge compares them: line by line, trailing spaces and tabs on
 * a line ignored, trailing blank lines ignored. Differences are marked down to the character, with
 * whitespace made visible (· space, → tab, ↵ line end), and every mark has a glyph or a word as well as colour.
 * Who may see which side is the page's decision: owners, administrators, editors and observers can open
 * hidden testcases; solvers only ever get the samples.
 */

type Kind = 'same' | 'wrong' | 'want' | 'missing' | 'extra' | 'ignored';
interface Segment {
  text: string;
  kind: Kind;
  title?: string;
}

const MAX_CHAR_DIFF = 400;
const FOLD_FROM_LINES = 40;
const FOLD_CONTEXT = 2;
const REVEAL_STEP = 20;

/** Lines as the judge compares them: trailing spaces on a line are ignored, and so are trailing blank lines. */
function lines(text: string): string[] {
  return text
    .replace(/\s+$/, '')
    .split('\n')
    .map((line) => line.replace(/[ \t\r]+$/, ''));
}

/** Lines as written (carriage returns dropped, final newline not a line), for drawing. */
function rawLines(text: string): string[] {
  const all = text.replace(/\r/g, '').split('\n');
  while (all.length > 0 && all.at(-1)!.trim() === '') all.pop();
  return all;
}

/** Index of the first line where the two outputs differ, or -1 when they match. */
export function firstDifference(expected: string, actual: string): number {
  const left = lines(expected);
  const right = lines(actual);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) if (left[index] !== right[index]) return index;
  return -1;
}

function push(list: Segment[], segment: Segment) {
  const last = list.at(-1);
  if (last && last.kind === segment.kind && !segment.title && !last.title) last.text += segment.text;
  else list.push(segment);
}

/** Character-level comparison of two lines: what to draw on each side. */
export function charDiff(expected: string, actual: string): { left: Segment[]; right: Segment[] } {
  const left: Segment[] = [];
  const right: Segment[] = [];
  if (expected.length > MAX_CHAR_DIFF || actual.length > MAX_CHAR_DIFF) {
    push(left, { text: expected, kind: 'want' });
    push(right, { text: actual, kind: 'wrong' });
    return { left, right };
  }
  const n = expected.length;
  const m = actual.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i]![j] =
        expected[i] === actual[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  let i = 0;
  let j = 0;
  let removed = '';
  let added = '';
  const flush = () => {
    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k++) {
      push(left, { text: removed[k]!, kind: 'want', title: `Expected “${removed[k]}”` });
      push(right, { text: added[k]!, kind: 'wrong', title: `Expected “${removed[k]}”` });
    }
    for (const ch of removed.slice(paired)) {
      push(left, { text: ch, kind: 'want' });
      push(right, { text: ch, kind: 'missing', title: ch === ' ' ? 'Missing space' : `Missing “${ch}”` });
    }
    for (const ch of added.slice(paired))
      push(right, { text: ch, kind: 'extra', title: ch === ' ' ? 'Extra space' : `Extra “${ch}”` });
    removed = '';
    added = '';
  };
  while (i < n || j < m) {
    if (i < n && j < m && expected[i] === actual[j]) {
      flush();
      push(left, { text: expected[i]!, kind: 'same' });
      push(right, { text: actual[j]!, kind: 'same' });
      i++;
      j++;
    } else if (j >= m || (i < n && table[i + 1]![j]! >= table[i]![j + 1]!)) removed += expected[i++];
    else added += actual[j++];
  }
  flush();
  return { left, right };
}

interface Row {
  expected?: string;
  actual?: string;
  /** Trailing spaces that the judge ignores, for drawing. */
  expectedTail: string;
  actualTail: string;
  differs: boolean;
  left: Segment[];
  right: Segment[];
}

function buildRows(expected: string, actual: string): Row[] {
  const left = rawLines(expected);
  const right = rawLines(actual);
  const total = Math.max(left.length, right.length);
  return Array.from({ length: total }, (_, index) => {
    const e = left[index];
    const a = right[index];
    const tail = (line?: string) => (line === undefined ? '' : (line.match(/[ \t]+$/)?.[0] ?? ''));
    const eTail = tail(e);
    const aTail = tail(a);
    const eBody = e === undefined ? undefined : e.slice(0, e.length - eTail.length);
    const aBody = a === undefined ? undefined : a.slice(0, a.length - aTail.length);
    const differs = eBody !== aBody;
    const diff = differs && eBody !== undefined && aBody !== undefined ? charDiff(eBody, aBody) : null;
    const same = (text?: string): Segment[] => (text === undefined ? [] : [{ text, kind: 'same' }]);
    return {
      expected: e,
      actual: a,
      expectedTail: eTail,
      actualTail: aTail,
      differs,
      left: diff ? diff.left : same(eBody),
      right: diff ? diff.right : same(aBody),
    };
  });
}

/** The sentences under the summary: first difference, extra and missing spaces, missing lines, ignored spaces. */
function notes(rows: Row[], actualName: string): { headline: string; details: string[] } {
  const total = rows.length;
  const differing = rows.filter((row) => row.differs);
  const first = rows.findIndex((row) => row.differs);
  const row = rows[first]!;
  let headline = `${differing.length} of ${total} ${total === 1 ? 'line differs' : 'lines differ'}. `;
  if (row.expected !== undefined && row.actual !== undefined) {
    let col = 0;
    const want = row.expected.replace(/[ \t]+$/, '');
    const got = row.actual.replace(/[ \t]+$/, '');
    while (col < want.length && col < got.length && want[col] === got[col]) col++;
    headline += `First difference at line ${first + 1}, column ${col + 1}: expected “${want[col] ?? 'end of line'}”, found “${got[col] ?? 'end of line'}”.`;
  } else if (row.expected === undefined) {
    headline += `First difference at line ${first + 1}: ${actualName} has an extra line.`;
  } else {
    headline += `First difference at line ${first + 1}: this line is missing from ${actualName}.`;
  }
  const details: string[] = [];
  rows.forEach((r, index) => {
    if (r.expected !== undefined && r.actual !== undefined && r.differs) {
      const extra = r.right.find((segment) => segment.kind === 'extra');
      const missing = r.right.find((segment) => segment.kind === 'missing');
      if (extra?.text === ' ') details.push(`Line ${index + 1} has an extra space.`);
      if (missing?.text === ' ') details.push(`Line ${index + 1} is missing a space.`);
    }
    if (r.actual === undefined && r.expected !== undefined) {
      details.push(`Line ${index + 1} is missing from ${actualName} (${actualName} has fewer lines than expected).`);
    }
    if (r.expected === undefined && r.actual !== undefined)
      details.push(`Line ${index + 1} is extra: it was not expected.`);
    if (r.actualTail && !r.differs)
      details.push(
        `Line ${index + 1} ends with a space. Trailing spaces are ignored by the judge, so it does not count.`
      );
  });
  return { headline, details: details.slice(0, 6) };
}

function visible(text: string, showWhitespace: boolean, kind: Kind) {
  const spaced = showWhitespace
    ? text
        .split(/([ \t])/)
        .filter((part) => part !== '')
        .map((part, index) =>
          part === ' ' || part === '\t' ? (
            <span key={index} className={kind === 'same' ? 'cd-ws' : undefined}>
              {part === ' ' ? (kind === 'missing' ? '␣' : '·') : '→'}
            </span>
          ) : (
            <React.Fragment key={index}>{part}</React.Fragment>
          )
        )
    : text;
  return spaced;
}

function Code({ row, side, showWhitespace }: { row: Row; side: 'left' | 'right'; showWhitespace: boolean }) {
  const segments = side === 'left' ? row.left : row.right;
  const tail = side === 'left' ? row.expectedTail : row.actualTail;
  return (
    <code>
      {segments.map((segment, index) => {
        const className =
          segment.kind === 'wrong' || segment.kind === 'extra'
            ? 'cd-x'
            : segment.kind === 'want'
              ? 'cd-want'
              : segment.kind === 'missing'
                ? 'cd-miss'
                : undefined;
        return (
          <span key={index} className={className} title={segment.title}>
            {visible(segment.text, showWhitespace, segment.kind)}
          </span>
        );
      })}
      {tail && (
        <span className="cd-ign" title="Trailing space, ignored by the judge">
          {showWhitespace ? tail.replace(/ /g, '·').replace(/\t/g, '→') : tail}
        </span>
      )}
      {showWhitespace && <span className="cd-ws">↵</span>}
    </code>
  );
}

type Item = { type: 'row'; index: number } | { type: 'fold'; from: number; to: number; id: string };

/**
 * Expected output beside the solver's: character-level marks, visible whitespace, missing and extra lines, and
 * matching lines folded away when the output is long. Title the columns with `expectedLabel` and `actualLabel`
 * ("Saved" and "Generated" when comparing a testcase's saved output with a new one).
 */
export function DiffView({
  expected,
  actual,
  expectedLabel = 'Expected output',
  actualLabel = 'Your output',
  actualName = 'the output',
  defaultShowWhitespace = true,
  foldLongOutput = true,
  rawHref,
}: {
  expected: string;
  actual: string;
  /** Title of the left column. */
  expectedLabel?: string;
  /** Title of the right column. */
  actualLabel?: string;
  /** How sentences refer to the right side: "the output", "the generated file". */
  actualName?: string;
  defaultShowWhitespace?: boolean;
  /** Fold runs of matching lines when the output has more than 40 lines. */
  foldLongOutput?: boolean;
  /** Link to the whole file as text, offered in a fold. */
  rawHref?: string;
}) {
  const rows = React.useMemo(() => buildRows(expected, actual), [expected, actual]);
  const [showWhitespace, setShowWhitespace] = React.useState(defaultShowWhitespace);
  const [onlyDifferent, setOnlyDifferent] = React.useState(false);
  const [revealed, setRevealed] = React.useState<Record<string, number>>({});

  const same = !rows.some((row) => row.differs);
  const summary = same ? null : notes(rows, actualName);

  const items = React.useMemo<Item[]>(() => {
    const fold = onlyDifferent || (foldLongOutput && rows.length > FOLD_FROM_LINES);
    if (!fold) return rows.map((_, index) => ({ type: 'row', index }));
    const context = onlyDifferent ? 0 : FOLD_CONTEXT;
    const show = rows.map((row, index) => {
      if (row.differs) return true;
      for (let k = Math.max(0, index - context); k <= Math.min(rows.length - 1, index + context); k++)
        if (rows[k]!.differs) return true;
      return false;
    });
    const result: Item[] = [];
    let index = 0;
    while (index < rows.length) {
      if (show[index]) {
        result.push({ type: 'row', index: index++ });
        continue;
      }
      const from = index;
      while (index < rows.length && !show[index]) index++;
      const id = String(from);
      const open = Math.min(index - from, revealed[id] ?? 0);
      for (let k = from; k < from + open; k++) result.push({ type: 'row', index: k });
      if (from + open < index) result.push({ type: 'fold', from: from + open, to: index, id });
    }
    return result;
  }, [rows, onlyDifferent, foldLongOutput, revealed]);

  const column = (side: 'left' | 'right') => (
    <div className="vd-diff__col" style={{ minWidth: 0 }}>
      <div className="vd-diff__head">
        {side === 'left' ? expectedLabel : actualLabel} ·{' '}
        {rows.filter((row) => (side === 'left' ? row.expected : row.actual) !== undefined).length} lines
      </div>
      <ol className="cd-lines">
        {items.map((item) => {
          if (item.type === 'fold') {
            const hidden = item.to - item.from;
            return (
              <li key={`fold-${item.id}`} className="cd-fold">
                <span>
                  {hidden} matching {hidden === 1 ? 'line' : 'lines'} hidden
                </span>
                {side === 'left' && (
                  <span>
                    {hidden > REVEAL_STEP && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + REVEAL_STEP }))
                        }
                      >
                        Show {REVEAL_STEP} more
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRevealed((current) => ({ ...current, [item.id]: item.to }))}
                    >
                      Show all
                    </button>
                    {rawHref && hidden > 1000 && (
                      <a href={rawHref} target="_blank" rel="noreferrer">
                        Open raw
                      </a>
                    )}
                  </span>
                )}
              </li>
            );
          }
          const row = rows[item.index]!;
          const own = side === 'left' ? row.expected : row.actual;
          const missing = own === undefined;
          return (
            <li key={item.index} className={cn('cd-line', row.differs && 'is-diff', missing && 'is-missing')}>
              <span className="cd-no" aria-hidden>
                {item.index + 1}
              </span>
              <span className="cd-gut" aria-hidden>
                {row.differs ? (missing ? '−' : '≠') : ''}
              </span>
              {missing ? (
                <code>{side === 'right' ? `(no line ${item.index + 1} in output)` : '(no such line expected)'}</code>
              ) : (
                <Code row={row} side={side} showWhitespace={showWhitespace} />
              )}
              {row.differs && <span className="vd-sr"> ({missing ? 'missing' : 'differs'})</span>}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="cd-line is-missing">
            <span className="cd-no" aria-hidden>
              1
            </span>
            <span className="cd-gut" aria-hidden />
            <code>(no output)</code>
          </li>
        )}
      </ol>
    </div>
  );

  return (
    <div className="vd-diff">
      <div className={cn('vd-diff__summary', same ? 'is-good' : 'is-bad')} role="status">
        {same ? (
          <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <CircleX className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        <span>{same ? 'Output matches the expected output.' : summary!.headline}</span>
      </div>
      {summary && summary.details.length > 0 && (
        <ul className="cd-notes">
          {summary.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      <div className="cd-options">
        <Toggle label="Show whitespace" checked={showWhitespace} onCheckedChange={setShowWhitespace} />
        <Toggle
          label="Only lines that differ"
          checked={onlyDifferent}
          disabled={same}
          onCheckedChange={setOnlyDifferent}
        />
        <span className="cd-legend">
          <span>
            <span className="cd-x vd-mono">3</span> wrong character
          </span>
          <span>
            <span className="cd-want vd-mono">2</span> expected character
          </span>
          <span>
            <span className="cd-miss vd-mono">␣</span> missing
          </span>
          <span>
            <span className="vd-mono cd-ws">·</span> space <span className="vd-mono cd-ws">→</span> tab{' '}
            <span className="vd-mono cd-ws">↵</span> line end
          </span>
          <span>
            <span className="vd-mono cd-ign">·</span> ignored
          </span>
        </span>
      </div>
      <div
        className="vd-diff__cols"
        role="group"
        aria-label={`${actualLabel} compared with ${expectedLabel.toLowerCase()}`}
      >
        {column('left')}
        {column('right')}
      </div>
    </div>
  );
}
