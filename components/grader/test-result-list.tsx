import { Badge } from '@/components/ui/badge';
import { formatMemory, formatTime } from '@/lib/format';
import { VerdictBadge } from './verdict-badge';
import { VerdictInfo } from './verdict-info';
import type { Verdict } from './verdict';

export interface TestResultRow {
  verdict: Verdict;
  timeMs?: number;
  memoryKb?: number;
  sample?: boolean;
  detail?: string;
}

/**
 * Per-test results of one submission, one row each. Hidden tests are labelled "Hidden" and carry no data of their own;
 * owners, administrators, editors and observers can open them elsewhere, solvers only ever see the samples.
 */
export function TestResultList({ rows, caption = 'Testcase results' }: { rows: TestResultRow[]; caption?: string }) {
  return (
    <div className="vd-tablewrap">
      <table className="vd-table">
        <caption className="vd-sr">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Testcase</th>
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
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <span className="vd-inline">
                  <span className="vd-mono">{index + 1}</span>
                  <Badge>{row.sample ? 'Sample' : 'Hidden'}</Badge>
                </span>
              </td>
              <td>
                <VerdictBadge verdict={row.verdict} detail={row.detail} format="auto" />
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
