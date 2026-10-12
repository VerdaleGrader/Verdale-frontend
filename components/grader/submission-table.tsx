import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { formatMemory, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VerdictBadge } from './verdict-badge';
import { VerdictInfo } from './verdict-info';
import type { Verdict } from './verdict';

export interface SubmissionRow {
  id: string | number;
  when: string;
  problem: string;
  href?: string;
  author: string;
  authorAvatarUrl?: string | null;
  language: string;
  verdict: Verdict;
  detail?: string;
  timeMs?: number;
  memoryKb?: number;
  /** The current user's latest row. */
  selected?: boolean;
}

/**
 * Submissions of a problem, a person or a Space in compact rows, newest first.
 * A row with an `href` opens it when its empty space is clicked; the problem link is the keyboard target.
 */
export function SubmissionTable({ rows }: { rows: SubmissionRow[] }) {
  return (
    <div className="vd-tablewrap">
      <table className="vd-table">
        <caption className="vd-sr">Submissions</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Problem</th>
            <th scope="col">Author</th>
            <th scope="col">Language</th>
            <th scope="col">
              <span className="vd-inline">
                Verdict
                <VerdictInfo />
              </span>
            </th>
            <th scope="col" className="is-num">
              Time
            </th>
            <th scope="col" className="is-num">
              Memory
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ClickableRow
              key={row.id}
              href={row.href}
              className={cn(row.selected && 'is-selected')}
              aria-current={row.selected || undefined}
            >
              <td className="vd-muted">
                <RowText>{row.when}</RowText>
              </td>
              <td>
                {row.href ? (
                  <Link href={row.href} className="vd-link">
                    {row.problem}
                  </Link>
                ) : (
                  row.problem
                )}
              </td>
              <td>
                <span className="vd-inline">
                  <Avatar name={row.author} src={row.authorAvatarUrl} size="sm" />
                  <RowText>{row.author}</RowText>
                </span>
              </td>
              <td className="vd-mono">
                <RowText>{row.language}</RowText>
              </td>
              <td>
                <VerdictBadge verdict={row.verdict} detail={row.detail} format="auto" />
              </td>
              <td className="is-num vd-mono">
                <RowText>{row.timeMs === undefined ? '–' : formatTime(row.timeMs)}</RowText>
              </td>
              <td className="is-num vd-mono">
                <RowText>{row.memoryKb === undefined ? '–' : formatMemory(row.memoryKb)}</RowText>
              </td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
