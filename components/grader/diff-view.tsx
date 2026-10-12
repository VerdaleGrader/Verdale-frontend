'use client';

import * as React from 'react';
import { CircleCheck, CircleX, Copy } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { formatCount } from '@/lib/format';
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
const ONE_SIDED_SHOWN = 3;

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
function notes(
  rows: Row[],
  actualName: string
): { headline: string; details: Array<{ text: string; muted?: boolean }> } {
  const total = rows.length;
  const differing = rows.filter((row) => row.differs);
  const first = rows.findIndex((row) => row.differs);
  const row = rows[first]!;
  let headline = `${formatCount(differing.length)} of ${formatCount(total)} ${total === 1 ? 'line differs' : 'lines differ'}. `;
  if (row.expected !== undefined && row.actual !== undefined) {
    let col = 0;
    const want = row.expected.replace(/[ \t]+$/, '');
    const got = row.actual.replace(/[ \t]+$/, '');
    while (col < want.length && col < got.length && want[col] === got[col]) col++;
    headline += `First difference at line ${formatCount(first + 1)}, column ${col + 1}: expected “${want[col] ?? 'end of line'}”, found “${got[col] ?? 'end of line'}”.`;
  } else if (row.expected === undefined) {
    headline += `First difference at line ${formatCount(first + 1)}: ${actualName} has an extra line.`;
  } else {
    headline += `First difference at line ${formatCount(first + 1)}: this line is missing from ${actualName}.`;
  }
  const printed = rows.filter((row) => row.actual !== undefined).length;
  const expectedCount = rows.filter((row) => row.expected !== undefined).length;
  const plural = (count: number, word: string) => `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`;
  const details: Array<{ text: string; muted?: boolean }> = [];
  rows.forEach((r, index) => {
    // Only a line that differs by whitespace alone gets a whitespace note; otherwise the characters are what is wrong.
    if (
      r.expected !== undefined &&
      r.actual !== undefined &&
      r.differs &&
      r.expected.replace(/\s/g, '') === r.actual.replace(/\s/g, '')
    ) {
      // Columns count from 1: where the extra space is in the output, where the missing one belongs in the expected line.
      let actualCol = 0;
      let expectedCol = 0;
      let extraAt = 0;
      let missingAt = 0;
      for (const segment of r.right) {
        if (segment.kind === 'extra' && segment.text === ' ' && !extraAt) extraAt = actualCol + 1;
        if (segment.kind === 'missing' && segment.text === ' ' && !missingAt) missingAt = expectedCol + 1;
        if (segment.kind !== 'missing') actualCol += segment.text.length;
        if (segment.kind !== 'extra') expectedCol += segment.text.length;
      }
      if (extraAt) details.push({ text: `Line ${index + 1} has an extra space at column ${extraAt}.` });
      if (missingAt) details.push({ text: `Line ${index + 1} is missing a space at column ${missingAt}.` });
    }
  });
  // Whole lines missing from one side or extra on it, a run at a time ("Lines 1,001–2,000 are extra").
  const run = (from: number, onlyOn: 'expected' | 'actual') => {
    let to = from;
    while (
      to + 1 < rows.length &&
      rows[to + 1]![onlyOn] !== undefined &&
      rows[to + 1]![onlyOn === 'expected' ? 'actual' : 'expected'] === undefined
    )
      to++;
    return to;
  };
  for (let index = 0; index < rows.length; index++) {
    const r = rows[index]!;
    const missing = r.actual === undefined && r.expected !== undefined;
    const extra = r.expected === undefined && r.actual !== undefined;
    if (!missing && !extra) continue;
    const to = run(index, missing ? 'expected' : 'actual');
    const lines =
      to === index ? `Line ${formatCount(index + 1)} is` : `Lines ${formatCount(index + 1)}–${formatCount(to + 1)} are`;
    details.push({
      text: missing
        ? `${lines} missing from ${actualName} (${actualName} has ${plural(printed, 'line')}, ${formatCount(expectedCount)} ${expectedCount === 1 ? 'was' : 'were'} expected).`
        : `${lines} extra: ${to === index ? 'it was' : 'they were'} not expected.`,
    });
    index = to;
  }
  // What the judge ignores comes last, and quieter: it is not part of why the answer is wrong.
  rows.forEach((r, index) => {
    if (r.actualTail && !r.differs)
      details.push({
        text: `Line ${index + 1} ends with a space. Trailing spaces are ignored by the judge, so it does not count.`,
        muted: true,
      });
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

/** What a folded run holds: lines that match, or lines only one side has. */
function foldKind(row: Row): string {
  if (!row.differs) return 'matching';
  return row.expected === undefined ? 'extra' : 'missing';
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
  between,
  copyable,
  expectedTotal,
  actualTotal,
  goToLine,
  outputFirst,
  plain,
  missingText,
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
  /** Shown between the options and the two columns (the testcase's input on the review pages). */
  between?: React.ReactNode;
  /** A copy button in each column's title, copying that side's text. */
  copyable?: boolean;
  /** Lines in the whole file when only the start is given (the title says so instead of counting what is shown). */
  expectedTotal?: number;
  actualTotal?: number;
  /** A "Go to line" box that opens folded lines and scrolls to the line. For long outputs. */
  goToLine?: boolean;
  /** The solver's output in the left column and the expected output on the right (the review pages' order). */
  outputFirst?: boolean;
  /** Only the two columns: no summary sentences, no options. For a program that stopped, where "differs" is not the point. */
  plain?: boolean;
  /** What a line of the right column says when the right side has none ("stopped before line 3"). */
  missingText?: (line: number) => string;
}) {
  const rows = React.useMemo(() => buildRows(expected, actual), [expected, actual]);
  const [showWhitespace, setShowWhitespace] = React.useState(defaultShowWhitespace);
  const [onlyDifferent, setOnlyDifferent] = React.useState(false);
  const [revealed, setRevealed] = React.useState<Record<string, number>>({});
  const [wrap, setWrap] = React.useState(false);
  const [target, setTarget] = React.useState('');
  const root = React.useRef<HTMLDivElement>(null);
  const [scrollTo, setScrollTo] = React.useState<number | null>(null);

  const same = !rows.some((row) => row.differs);
  const summary = same ? null : notes(rows, actualName);

  const items = React.useMemo<Item[]>(() => {
    const fold = onlyDifferent || (foldLongOutput && rows.length > FOLD_FROM_LINES);
    if (!fold) return rows.map((_, index) => ({ type: 'row', index }));
    const context = onlyDifferent ? 0 : FOLD_CONTEXT;
    // A long run of lines that exist on one side only (an output that never stops) shows its start and folds the rest.
    const oneSided = (row: Row) => row.expected === undefined || row.actual === undefined;
    const hiddenRun = new Array<boolean>(rows.length).fill(false);
    for (let start = 0; start < rows.length; ) {
      if (!oneSided(rows[start]!)) {
        start++;
        continue;
      }
      let end = start;
      while (end + 1 < rows.length && oneSided(rows[end + 1]!)) end++;
      if (end - start + 1 > ONE_SIDED_SHOWN * 3)
        for (let k = start + ONE_SIDED_SHOWN; k <= end; k++) hiddenRun[k] = true;
      start = end + 1;
    }
    const show = rows.map((row, index) => {
      if (hiddenRun[index]) return false;
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

  React.useEffect(() => {
    if (scrollTo === null) return;
    root.current?.querySelector(`[data-line="${scrollTo}"]`)?.scrollIntoView?.({ block: 'center' });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot request from the form
    setScrollTo(null);
  }, [scrollTo, items]);

  const column = (side: 'left' | 'right') => (
    <div className="vd-diff__col" style={{ minWidth: 0 }}>
      <div className="vd-diff__head" style={copyable ? { justifyContent: 'space-between' } : undefined}>
        <span>
          {side === 'left' ? expectedLabel : actualLabel} ·{' '}
          {formatCount(
            (side === 'left' ? expectedTotal : actualTotal) ??
              rows.filter((row) => (side === 'left' ? row.expected : row.actual) !== undefined).length
          )}{' '}
          lines
        </span>
        {copyable && (
          <button
            type="button"
            className="vd-iconbtn"
            aria-label={`Copy ${(side === 'left' ? expectedLabel : actualLabel).toLowerCase()}`}
            onClick={() => void navigator.clipboard?.writeText(side === 'left' ? expected : actual)}
          >
            <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      <ol className="cd-lines">
        {items.map((item) => {
          if (item.type === 'fold') {
            const hidden = item.to - item.from;
            return (
              <li key={`fold-${item.id}`} className="cd-fold">
                <span>
                  {formatCount(hidden)} {foldKind(rows[item.from]!)} {hidden === 1 ? 'line' : 'lines'} hidden
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
            <li
              key={item.index}
              data-line={item.index + 1}
              className={cn('cd-line', row.differs && 'is-diff', missing && 'is-missing')}
            >
              <span className="cd-no" aria-hidden>
                {formatCount(item.index + 1)}
              </span>
              <span className="cd-gut" aria-hidden>
                {row.differs ? (missing ? '−' : row.expected === undefined ? '+' : '≠') : ''}
              </span>
              {missing ? (
                <code>
                  {side === 'right'
                    ? (missingText?.(item.index + 1) ?? `(no line ${item.index + 1} in output)`)
                    : '(no such line expected)'}
                </code>
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
    <div className={cn('vd-diff', wrap && 'is-wrapped')} ref={root}>
      {!plain && (
        <div className={cn('vd-diff__summary', same ? 'is-good' : 'is-bad')} role="status">
          <p className="vd-diff__headline">
            {same ? (
              <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <CircleX className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            <span>{same ? 'Output matches the expected output.' : summary!.headline}</span>
          </p>
          {summary && summary.details.length > 0 && (
            <ul className="cd-notes">
              {summary.details.map((detail) => (
                <li key={detail.text} className={cn(detail.muted && 'is-muted')}>
                  {detail.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!plain && (
        <div className="cd-options">
          <Toggle label="Show whitespace" checked={showWhitespace} onCheckedChange={setShowWhitespace} />
          <Toggle
            label="Only lines that differ"
            checked={onlyDifferent}
            disabled={same}
            onCheckedChange={setOnlyDifferent}
          />
          {goToLine && (
            <>
              <Toggle label="Wrap long lines" checked={wrap} onCheckedChange={setWrap} />
              <form
                className="inline-flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const line = Number(target.replace(/[,\s]/g, ''));
                  if (!Number.isInteger(line) || line < 1 || line > rows.length) return;
                  // Open the folded run the line is in, then scroll once it is drawn.
                  const fold = items.find(
                    (item) => item.type === 'fold' && line - 1 >= item.from && line - 1 < item.to
                  );
                  if (fold && fold.type === 'fold') {
                    const first = Number(fold.id);
                    setRevealed((current) => ({ ...current, [fold.id]: line - first }));
                  }
                  setScrollTo(line);
                }}
              >
                <label className="vd-label" htmlFor="diff-goto" style={{ fontWeight: 500 }}>
                  Go to line
                </label>
                <input
                  id="diff-goto"
                  className="vd-input vd-input--mono"
                  style={{ width: 96, height: 28 }}
                  inputMode="numeric"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                />
              </form>
            </>
          )}
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
      )}
      {between}
      <div
        className="vd-diff__cols"
        role="group"
        aria-label={`${actualLabel} compared with ${expectedLabel.toLowerCase()}`}
      >
        {outputFirst ? column('right') : column('left')}
        {outputFirst ? column('left') : column('right')}
      </div>
    </div>
  );
}
