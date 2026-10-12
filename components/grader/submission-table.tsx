import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { formatMemory, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VerdictBadge } from './verdict-badge';
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

/** Submissions of a problem, a person or a Space in compact rows, newest first. */
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
            <th scope="col">Verdict</th>
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
            <tr key={row.id} className={cn(row.selected && 'is-selected')} aria-current={row.selected || undefined}>
              <td className="vd-muted">{row.when}</td>
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
                  {row.author}
                </span>
              </td>
              <td className="vd-mono">{row.language}</td>
              <td>
                <VerdictBadge verdict={row.verdict} detail={row.detail} />
              </td>
              <td className="is-num vd-mono">{row.timeMs === undefined ? '–' : formatTime(row.timeMs)}</td>
              <td className="is-num vd-mono">{row.memoryKb === undefined ? '–' : formatMemory(row.memoryKb)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
