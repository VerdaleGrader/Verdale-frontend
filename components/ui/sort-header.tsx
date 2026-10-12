'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

/**
 * A column header that sorts the table: `aria-sort` on the cell and an arrow for the sorted column.
 * Pressing it sorts by this column, or flips the direction when it is already the sorted one.
 * Use inside <thead><tr>; a column that cannot be sorted stays a plain <th>.
 */
export function SortHeader({
  children,
  direction,
  onSort,
  numeric,
}: {
  children: React.ReactNode;
  /** The direction when this column is the sorted one, otherwise undefined. */
  direction?: SortDirection;
  onSort: () => void;
  numeric?: boolean;
}) {
  const Arrow = direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      className={cn(numeric && 'is-num')}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
    >
      <button type="button" className={cn('vd-sort', direction && 'is-sorted')} onClick={onSort}>
        {children}
        {direction && <Arrow className="size-3" strokeWidth={2} aria-hidden />}
      </button>
    </th>
  );
}

export type { SortDirection };
