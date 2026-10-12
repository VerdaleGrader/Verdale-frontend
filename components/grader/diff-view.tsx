import { CircleCheck, CircleX } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Lines as the judge compares them: trailing spaces on a line are ignored. */
function lines(text: string): string[] {
  return text
    .replace(/\s+$/, '')
    .split('\n')
    .map((line) => line.replace(/[ \t\r]+$/, ''));
}

/** Index of the first line where the two outputs differ, or -1 when they match. */
export function firstDifference(expected: string, actual: string): number {
  const left = lines(expected);
  const right = lines(actual);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) if (left[index] !== right[index]) return index;
  return -1;
}

function Column({ title, own, other }: { title: string; own: string[]; other: string[] }) {
  return (
    <div className="vd-diff__col">
      <div className="vd-diff__head">{title}</div>
      <ol className="vd-diff__lines">
        {own.map((line, index) => {
          const differs = line !== other[index];
          return (
            <li key={index} className={cn('vd-diff__line', differs && 'is-diff')}>
              <span className="vd-diff__no" aria-hidden>
                {index + 1}
              </span>
              <code>{line === '' ? ' ' : line}</code>
              {differs && <span className="vd-sr"> (differs)</span>}
            </li>
          );
        })}
        {own.length === 0 && (
          <li className="vd-diff__line is-missing">
            <span className="vd-diff__no" aria-hidden>
              1
            </span>
            <code>(no output)</code>
          </li>
        )}
      </ol>
    </div>
  );
}

/** Expected output beside the solver's, for SAMPLE tests only. Never render it for a hidden test. */
export function DiffView({
  expected,
  actual,
  actualLabel = 'Your output',
}: {
  expected: string;
  actual: string;
  actualLabel?: string;
}) {
  const at = firstDifference(expected, actual);
  const same = at === -1;
  return (
    <div className="vd-diff">
      <p className={cn('vd-diff__summary', same ? 'is-good' : 'is-bad')} role="status">
        {same ? (
          <CircleCheck className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <CircleX className="size-4" strokeWidth={1.75} aria-hidden />
        )}
        {same ? 'Output matches the expected output.' : `Outputs differ from line ${at + 1}.`}
      </p>
      <div className="vd-diff__cols">
        <Column title="Expected output" own={lines(expected)} other={lines(actual)} />
        <Column title={actualLabel} own={lines(actual)} other={lines(expected)} />
      </div>
    </div>
  );
}
