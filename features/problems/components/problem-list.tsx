'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { formatMemory, formatTime, timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { problemsApi } from '../api/problems.api';
import { LANGUAGE_LABELS, STATUS_LABELS, type ProblemStatus, type ProblemSummary } from '../types';

const PAGE_SIZE = 20;

const STATUS_FILTERS = ['published', 'draft', 'archived', 'all'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

// Search, status and page live in the URL (?q=…&status=…&page=…); defaults are left out.
const QUERY = { q: param.text(), status: param.oneOf(STATUS_FILTERS, 'published'), page: param.page() };

const FILTER_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const STATUS_TONE: Record<ProblemStatus, 'brand' | 'warning' | 'neutral'> = {
  published: 'brand',
  draft: 'warning',
  archived: 'neutral',
};

/** The problems of a Space: published ones for everybody; owners and editors can also list drafts and archived ones. */
export function ProblemList() {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const author = abilities.canAuthorProblems;
  const { values, set } = useUrlQuery(QUERY);
  const { q: query, status, page } = values;
  const [input, setInput] = useDebouncedText(query, (text) => set({ q: text }));

  const effectiveStatus: StatusFilter = author ? status : 'published';
  const problems = useApiQuery(
    () => problemsApi.list(space.slug, { q: query, status: effectiveStatus, page, pageSize: PAGE_SIZE }),
    `problems-${space.slug}-${auth.status}-${effectiveStatus}-${query}-${page}`
  );

  return (
    <section aria-labelledby="problems-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="problems-heading" className="text-h2">
          Problems
        </h2>
        {abilities.canCreateProblems && (
          <Link href={`/spaces/${space.slug}/problems/new`} className={buttonVariants({ variant: 'secondary' })}>
            <Plus aria-hidden />
            New problem
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          type="search"
          label="Search problems"
          placeholder="Title or slug"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full max-w-xs"
        />
        {author && (
          <Dropdown
            label="Show"
            value={status}
            options={FILTER_OPTIONS}
            onValueChange={(next) => set({ status: next as StatusFilter })}
            className="w-44"
          />
        )}
      </div>

      {problems.status === 'loading' && <Loading label="Loading problems" />}
      {problems.status === 'error' && <ErrorState error={problems.error} onRetry={problems.reload} />}
      {problems.status === 'success' &&
        (problems.data.items.length === 0 ? (
          <EmptyState
            title={query ? `No problems match “${query}”` : emptyTitle(effectiveStatus)}
            description={emptyDescription(query, effectiveStatus, abilities.canCreateProblems, abilities.archived)}
            action={
              !query && abilities.canCreateProblems ? (
                <Link href={`/spaces/${space.slug}/problems/new`} className={buttonVariants({ variant: 'secondary' })}>
                  <Plus aria-hidden />
                  New problem
                </Link>
              ) : auth.status === 'anonymous' ? (
                <Link
                  href={`/login?next=${encodeURIComponent(`/spaces/${space.slug}`)}`}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  Log in to take part
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ProblemTable spaceSlug={space.slug} problems={problems.data.items} author={author} />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={problems.data.total}
              onPage={(next) => set({ page: next })}
            />
          </>
        ))}
    </section>
  );
}

function emptyTitle(status: StatusFilter) {
  if (status === 'draft') return 'No drafts';
  if (status === 'archived') return 'No archived problems';
  return 'No problems yet';
}

function emptyDescription(query: string, status: StatusFilter, canCreate: boolean, archived: boolean) {
  if (query) return 'Try a shorter or different word.';
  if (archived) return 'This Space was archived without problems.';
  if (status === 'published' && canCreate) {
    return 'Start a draft, add tests and a reference solution, then publish it for others to solve.';
  }
  if (status === 'published') return 'Problems published in this Space will appear here.';
  return 'Nothing to show for this filter.';
}

function ProblemTable({
  spaceSlug,
  problems,
  author,
}: {
  spaceSlug: string;
  problems: ProblemSummary[];
  author: boolean;
}) {
  return (
    <div className="vd-tablewrap">
      <table className="vd-table">
        <caption className="vd-sr">Problems</caption>
        <thead>
          <tr>
            <th scope="col">Problem</th>
            {author && <th scope="col">Status</th>}
            <th scope="col">Languages</th>
            <th scope="col" className="is-num">
              Time
            </th>
            <th scope="col" className="is-num">
              Memory
            </th>
            <th scope="col">Updated</th>
            {author && (
              <th scope="col">
                <span className="vd-sr">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {problems.map((problem) => (
            // Empty space in a row opens the editor for those who may edit; the title still opens the problem.
            <ClickableRow
              key={problem.id}
              href={author ? `/spaces/${spaceSlug}/problems/${problem.slug}/edit` : undefined}
            >
              <td>
                <Link href={`/spaces/${spaceSlug}/problems/${problem.slug}`} className="vd-link">
                  {problem.title}
                </Link>
                <span className="text-mono-label text-text-muted block">
                  <RowText>{problem.slug}</RowText>
                </span>
              </td>
              {author && (
                <td>
                  <Badge tone={STATUS_TONE[problem.status]}>{STATUS_LABELS[problem.status]}</Badge>
                </td>
              )}
              <td className="vd-muted">
                <RowText>{problem.allowed_languages.map((language) => LANGUAGE_LABELS[language]).join(', ')}</RowText>
              </td>
              <td className="is-num vd-mono">
                <RowText>{formatTime(problem.time_limit_ms)}</RowText>
              </td>
              <td className="is-num vd-mono">
                <RowText>{formatMemory(problem.memory_limit_kb)}</RowText>
              </td>
              <td className="vd-muted">
                <RowText>{timeAgo(problem.updated_at)}</RowText>
              </td>
              {author && (
                <td>
                  <Link href={`/spaces/${spaceSlug}/problems/${problem.slug}/edit`} className="vd-link">
                    Edit
                  </Link>
                </td>
              )}
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
