'use client';

import { Popover } from 'radix-ui';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FINAL_VERDICTS, VERDICT_SUMMARIES, VERDICTS, type Verdict } from './verdict';
import { VerdictBadge } from './verdict-badge';

const ALL: Verdict[] = [...FINAL_VERDICTS, 'QUEUED', 'RUNNING', 'SKIPPED'];

/**
 * An info button that opens a list of every verdict: icon, full name, code and what it means.
 * A popover and not a tooltip, because it holds a list people read and scroll (Esc closes it).
 */
export function VerdictInfo({
  current,
  label = 'What do the verdicts mean?',
  align = 'start',
}: {
  /** The verdict on screen, marked in the list. */
  current?: Verdict;
  label?: string;
  align?: 'start' | 'end';
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="vd-iconbtn vd-iconbtn--sm" aria-label={label}>
        <Info className="size-4" strokeWidth={1.75} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} className="vd-popup vd-verdictinfo">
          <p className="vd-popup__label">Verdicts</p>
          <ul className="vd-verdictinfo__list">
            {ALL.map((verdict) => (
              <li
                key={verdict}
                className={cn('vd-verdictinfo__item', verdict === current && 'is-current')}
                aria-current={verdict === current ? 'true' : undefined}
              >
                <VerdictBadge verdict={verdict} />
                <span className="vd-mono vd-muted">{VERDICTS[verdict].code}</span>
                <span className="vd-verdictinfo__text">{VERDICT_SUMMARIES[verdict]}</span>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
