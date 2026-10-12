'use client';

import * as React from 'react';
import { EyeOff } from 'lucide-react';
import { Dropdown } from '@/components/ui/dropdown';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VerdictBadge } from './verdict-badge';
import type { Verdict } from './verdict';

export interface TestcaseItem {
  id: string | number;
  /** 1-based position in judging order. */
  position: number;
  /** A sample (visible to solvers) or hidden. */
  sample: boolean;
  verdict: Verdict;
  timeMs?: number;
}

type Show = 'all' | 'failed' | 'samples' | 'hidden';

const SHOW_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'failed', label: 'Failed only' },
  { value: 'samples', label: 'Samples' },
  { value: 'hidden', label: 'Hidden' },
];

const PASSING: Verdict[] = ['AC', 'SKIPPED', 'QUEUED', 'RUNNING'];
// Skipped testcases after the first few collapse into one summary row.
const SKIPPED_SHOWN = 2;

/**
 * The testcases of a submission, down the left of its detail page: Samples first, then Hidden (hidden ones are
 * only ever listed for people who may see them), the selected one marked, and the long run of skipped
 * testcases after a failure folded into one line. Each row is a button.
 */
export function TestcaseList({
  items,
  selectedId,
  onSelect,
  label = 'Testcases',
}: {
  items: TestcaseItem[];
  selectedId?: string | number;
  onSelect: (id: TestcaseItem['id']) => void;
  label?: string;
}) {
  const [show, setShow] = React.useState<Show>('all');
  const [showSkipped, setShowSkipped] = React.useState(false);

  const filtered = items.filter((item) =>
    show === 'failed'
      ? !PASSING.includes(item.verdict)
      : show === 'samples'
        ? item.sample
        : show === 'hidden'
          ? !item.sample
          : true
  );
  const skipped = filtered.filter((item) => item.verdict === 'SKIPPED');
  const folded = !showSkipped && show === 'all' && skipped.length > SKIPPED_SHOWN ? skipped.slice(SKIPPED_SHOWN) : [];
  const foldedIds = new Set(folded.map((item) => item.id));
  const listed = filtered.filter((item) => !foldedIds.has(item.id));
  const groups = [
    { key: 'samples', title: 'Samples', rows: listed.filter((item) => item.sample) },
    { key: 'hidden', title: 'Hidden from solvers', rows: listed.filter((item) => !item.sample) },
  ].filter((group) => group.rows.length > 0);

  return (
    <aside aria-label={label} className="vd-tclist">
      <div className="vd-tclist__head">
        <span className="vd-tclist__count">
          {items.length} {items.length === 1 ? 'testcase' : 'testcases'}
        </span>
        <Dropdown
          aria-label="Show"
          size="sm"
          className="vd-tclist__show"
          value={show}
          options={SHOW_OPTIONS}
          onValueChange={(next) => setShow(next as Show)}
        />
      </div>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.title}>
          <p className="vd-tclist__group">
            {group.key === 'hidden' && <EyeOff className="size-3" strokeWidth={2} aria-hidden />}
            {group.title}
          </p>
          <ul>
            {group.rows.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="vd-tclist__item"
                  aria-current={item.id === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span className={cn(item.id === selectedId && 'font-medium')}>Testcase {item.position}</span>
                  <span className="vd-mono vd-muted">{item.timeMs === undefined ? '—' : formatTime(item.timeMs)}</span>
                  <VerdictBadge verdict={item.verdict} format="short" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p className="vd-tclist__note">No testcases match this filter.</p>}
      {folded.length > 0 && (
        <p className="vd-tclist__note">
          Testcases {folded[0]!.position}–{folded.at(-1)!.position} skipped: judging stops at the first failed testcase.{' '}
          <button type="button" className="vd-linkbtn" onClick={() => setShowSkipped(true)}>
            Show all
          </button>
        </p>
      )}
    </aside>
  );
}
