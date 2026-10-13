'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { useSpace } from '@/features/spaces/components/space-shell';
import { formatDateTime, timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useUrlQuery } from '@/lib/use-url-query';
import { problemsApi } from '../api/problems.api';
import type { VersionHistoryEntry } from '../types';
import { describeHistoryEntry, fieldLabel } from '../versioning';
import { useProblemWorkspace } from './problem-workspace';

const PAGE_SIZE = 20;
const QUERY = { page: param.page() };

/**
 * The History tab: one row per update or state change, newest first. Old and new values open under the row, so the
 * list stays short. Owners, administrators, editors and observers read it; nobody changes anything here.
 */
export function VersionHistory() {
  const { target } = useProblemWorkspace();
  const { abilities } = useSpace();
  const { values, set } = useUrlQuery(QUERY);
  const { page } = values;
  const history = useApiQuery(
    () => problemsApi.history(target, page, PAGE_SIZE),
    `history-${target.slug}-${target.problemSlug}-${page}`
  );

  if (!abilities.canAuthorProblems) {
    return (
      <EmptyState
        title="History is for the Space’s staff"
        description="Owners, administrators, editors and observers can read it."
      />
    );
  }
  if (history.status === 'loading') return <Loading label="Loading the history" />;
  if (history.status === 'error') return <ErrorState error={history.error} onRetry={history.reload} />;
  if (history.data.items.length === 0) {
    return (
      <EmptyState
        title="No history yet"
        description="Updates and state changes (draft, verifying, verified, published) of this problem appear here."
      />
    );
  }
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-4">
      <h2 id="history-heading" className="text-h2">
        Version history
      </h2>
      <div className="vd-tablewrap">
        <table className="vd-table">
          <caption className="vd-sr">Version history, newest first</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="vd-sr">Details</span>
              </th>
              <th scope="col">Version</th>
              <th scope="col">Change</th>
              <th scope="col">Who</th>
              <th scope="col">When</th>
              <th scope="col">Fields</th>
            </tr>
          </thead>
          <tbody>
            {history.data.items.map((entry) => (
              <HistoryRows key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={history.data.total} onPage={(next) => set({ page: next })} />
    </section>
  );
}

function HistoryRows({ entry }: { entry: VersionHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const described = describeHistoryEntry(entry);
  const expandable = entry.changes.length > 0;
  return (
    <>
      <tr>
        <td>
          {expandable && (
            <button
              type="button"
              className="vd-iconbtn"
              aria-expanded={open}
              aria-label={open ? 'Hide old and new values' : 'Show old and new values'}
              onClick={() => setOpen(!open)}
            >
              {open ? (
                <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
              ) : (
                <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
              )}
            </button>
          )}
        </td>
        <td className="vd-mono">{entry.label}</td>
        <td>
          <span className="vd-inline">
            <Badge tone={described.kind === 'minor' ? 'info' : described.kind === 'major' ? 'warning' : 'neutral'}>
              {described.label}
            </Badge>
            {entry.forced && <Badge tone="warning">Forced</Badge>}
          </span>
        </td>
        <td>{entry.actor.display_name}</td>
        <td className="vd-muted" title={formatDateTime(entry.at)}>
          {timeAgo(entry.at)}
        </td>
        <td>{entry.changes.map((change) => fieldLabel(change.field)).join(', ') || '–'}</td>
      </tr>
      {open && (
        <tr>
          <td />
          <td colSpan={5}>
            <dl className="flex flex-col gap-2">
              {entry.changes.map((change) => (
                <div key={change.field} className="text-small grid gap-1 sm:grid-cols-[10rem_1fr_1fr]">
                  <dt className="text-body-strong">{fieldLabel(change.field)}</dt>
                  <dd className="bg-danger-soft rounded-md p-2 break-words whitespace-pre-wrap">
                    <span className="vd-sr">Old: </span>
                    {change.old ?? '–'}
                  </dd>
                  <dd className="bg-verdict-ac-soft rounded-md p-2 break-words whitespace-pre-wrap">
                    <span className="vd-sr">New: </span>
                    {change.new ?? '–'}
                  </dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
