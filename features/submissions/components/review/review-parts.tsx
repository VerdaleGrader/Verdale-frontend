'use client';

import Link from 'next/link';
import { FileCheck2, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { DropdownOption } from '@/components/ui/dropdown';
import { TextField } from '@/components/ui/field';
import { FilterChips, type FilterChip } from '@/components/ui/filter-chips';
import { useToast } from '@/components/ui/toast';
import { ErrorState, TableSkeleton } from '@/components/states/states';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError } from '@/lib/api';
import { formatDateTime, timeAgo } from '@/lib/format';
import { useApiQuery, type QueryState } from '@/lib/use-api-query';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RowText } from '@/components/ui/clickable-row';
import { reviewApi, type TrackRollup } from '../../api/review.api';

/** Where the Space-wide pages live. */
export const reviewPath = (slug: string, ...rest: string[]) =>
  `/spaces/${slug}/submissions${rest.map((part) => `/${encodeURIComponent(part)}`).join('')}`;

/** The id as people say it: `#` and eight characters. Core's ids are UUIDs, so the first eight characters stand in for a number. */
export const shortId = (id: string) => `#${id.slice(0, 8)}`;

/** "This page isn't available": the same page for a missing thing and for a role that may not see it (404 for both). */
export function Unavailable({
  title = 'This page isn’t available',
  description = 'It may not exist, or your role in this Space doesn’t let you see it.',
  href,
  action = 'Back to the Space',
}: {
  title?: string;
  description?: string;
  href: string;
  action?: string;
}) {
  return (
    <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-md border px-6 py-12 text-center">
      <h2 className="text-h3">{title}</h2>
      <p className="text-text-muted max-w-[44ch]">{description}</p>
      <Link href={href} className={buttonVariants({ variant: 'secondary' })}>
        {action}
      </Link>
    </div>
  );
}

/** Only staff (owner, administrator, editor, observer) see the Space-wide pages; everyone else gets the 404 state. */
export function ReviewGate({ children }: { children: React.ReactNode }) {
  const { space, abilities } = useSpace();
  if (!abilities.canReviewSubmissions) {
    return (
      <Unavailable
        title="Submissions aren’t available"
        description="Only owners, administrators, editors and observers can see everyone’s submissions. You can find your own on each problem’s page."
        href={`/spaces/${space.slug}`}
      />
    );
  }
  // The design stacks the page's parts 16 px apart, closer than the 24 px between the Space header and its tabs.
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** 403 and 404 from Core mean "not for you or not there"; anything else is a failure worth a retry. */
export function isMissing(error: Error | undefined) {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

/** Page heading with the "Copy link to this view" button: filters live in the URL, so the link is the view. */
export function ReviewIntro({ title, description }: { title: string; description: string }) {
  const toast = useToast();
  const { abilities } = useSpace();
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ tone: 'success', title: 'Link copied' });
    } catch {
      toast({ tone: 'danger', title: 'Could not copy the link', description: 'Copy it from the address bar instead.' });
    }
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-h2">{title}</h2>
        <p className="text-text-muted">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {!abilities.canEditProblems && abilities.canReviewSubmissions && <Badge tone="info">View only</Badge>}
        <Button size="sm" onClick={copy}>
          <Link2 aria-hidden />
          Copy link to this view
        </Button>
      </div>
    </div>
  );
}

export type Group = 'member' | 'track' | 'problem';

/** Group by: Member, Track or Problem, each with how many there are. The group is in the URL (`?group=track`). */
export function GroupTabs({ slug, active }: { slug: string; active: Group }) {
  const { auth } = useAuth();
  const counts = useApiQuery(async () => {
    const space = { slug };
    const [members, tracks, problems] = await Promise.all([
      reviewApi.byMember(space, { hideEmpty: false, page: 1, pageSize: 1 }),
      reviewApi.byTrack(space),
      reviewApi.byProblem(space, { page: 1, pageSize: 1 }),
    ]);
    return { member: members.total, track: tracks.items.length, problem: problems.total };
  }, `group-counts-${slug}-${auth.status}`);
  const tabs: Array<{ group: Group; label: string; href: string }> = [
    { group: 'member', label: 'Member', href: reviewPath(slug) },
    { group: 'track', label: 'Track', href: `${reviewPath(slug)}?group=track` },
    { group: 'problem', label: 'Problem', href: `${reviewPath(slug)}?group=problem` },
  ];
  return (
    <nav aria-label="Group by" className="vd-tabs">
      <span className="text-text-muted self-center pr-2 text-xs font-medium">Group by</span>
      {tabs.map((tab) => (
        <Link
          key={tab.group}
          href={tab.href}
          aria-current={tab.group === active ? 'page' : undefined}
          className={cn('vd-tab', tab.group === active && 'is-active')}
        >
          {tab.label}
          {counts.status === 'success' && <span className="vd-tab__count">{counts.data[tab.group]}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** The row of filters: search first, then dropdowns. A `role="search"` form so screen readers can jump to it. */
export function FilterBar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <form
      role="search"
      aria-label={label}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      {children}
    </form>
  );
}

export function SearchField({
  label = 'Search',
  placeholder,
  value,
  onChange,
  className = 'max-w-[360px] flex-[1_1_280px]',
}: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  className?: string;
}) {
  return (
    <TextField
      type="search"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}

/** Chips for the filters that are on, and a count at the right. */
export function ResultsBar({
  chips,
  onRemove,
  onClear,
  children,
}: {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChips filters={chips} onRemove={onRemove} onClear={onClear} />
      {children && (
        <span className="text-small text-text-muted ml-auto inline-flex flex-wrap items-center gap-2">{children}</span>
      )}
    </div>
  );
}

const FAILURE_HELP =
  'Check your connection and try again. If it keeps happening, send the reference below to the Space owner.';

interface Column {
  header: string;
  numeric?: boolean;
  width?: number;
}

/**
 * What a list shows while its query is in flight, after it failed, when nothing matches the filters and when there
 * is nothing at all. Filters, search and the Group by tabs stay usable around it.
 */
export function TableState<T>({
  query,
  columns,
  label,
  filtered,
  onClear,
  isEmpty,
  empty,
  failure,
  children,
}: {
  query: QueryState<T> & { reload: () => void };
  columns: Column[];
  label: string;
  filtered: boolean;
  onClear: () => void;
  isEmpty: (data: T) => boolean;
  empty: React.ReactNode;
  failure: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.status === 'loading') return <TableSkeleton columns={columns} label={`Loading ${label}`} />;
  if (query.status === 'error')
    return (
      <ErrorState error={query.error} title={failure} description={FAILURE_HELP} onRetry={query.reload} centered />
    );
  if (!isEmpty(query.data)) return <>{children(query.data)}</>;
  if (!filtered) return <>{empty}</>;
  return (
    <div className="vd-tablewrap">
      <table className="vd-table">
        <caption className="vd-sr">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn(column.numeric && 'is-num')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="h-40 text-center whitespace-normal">
              <p className="mb-1 font-medium">No {label} match these filters</p>
              <p className="text-text-muted mb-3">Remove a filter or clear them all to see more.</p>
              <Button size="sm" onClick={onClear}>
                Clear filters
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Nothing at all yet (not a filter that matches nothing). */
export function NothingYet({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-md border px-6 py-16 text-center">
      <span className="bg-primary-soft text-brand-text grid size-12 place-items-center rounded-md" aria-hidden>
        <FileCheck2 className="size-6" strokeWidth={1.75} />
      </span>
      <h3 className="text-h3">{title}</h3>
      <p className="text-text-muted max-w-[44ch]">{description}</p>
      <Link href={href} className={buttonVariants({ variant: 'secondary' })}>
        {action}
      </Link>
    </div>
  );
}

/** A card with the numbers of what the page is about: a member, a Track, a problem. */
export function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      className="border-border bg-surface flex flex-wrap items-center justify-between gap-6 rounded-md border p-4"
    >
      {children}
    </section>
  );
}

export const OPTION_ALL = 'all';

/** "All tracks", "Not in any track" and every Track: feeds the Track filters. `null` until they are known. */
export function useTrackOptions(slug: string, allLabel = 'All tracks', withNone = true) {
  const { auth } = useAuth();
  const tracks = useApiQuery(() => reviewApi.byTrack({ slug }), `track-options-${slug}-${auth.status}`);
  const items: TrackRollup[] = tracks.status === 'success' ? tracks.data.items : [];
  const options: DropdownOption[] = [
    { value: OPTION_ALL, label: allLabel },
    ...(withNone ? [{ value: 'none', label: 'Not in any track' }] : []),
    ...items.map((item) => ({ value: item.track.slug, label: item.track.name })),
  ];
  const known = (value: string) => tracks.status !== 'success' || options.some((option) => option.value === value);
  const nameOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;
  return { options, known, nameOf, loaded: tracks.status === 'success' };
}

/** SortHeader props for a column whose sort has a direction or two: pressing a sorted column flips it when it can. */
export function sortProps<S extends string>(current: S, keys: { desc?: S; asc?: S }, set: (sort: S) => void) {
  const direction = current === keys.desc ? ('desc' as const) : current === keys.asc ? ('asc' as const) : undefined;
  const next =
    direction === 'desc'
      ? (keys.asc ?? keys.desc)
      : direction === 'asc'
        ? (keys.desc ?? keys.asc)
        : (keys.desc ?? keys.asc);
  return { direction, onSort: () => set(next!) };
}

export const dash = <span className="vd-muted">—</span>;

/** "4 minutes ago", with the exact time in the tooltip. */
export function When({ iso }: { iso: string | null }) {
  if (!iso) return <RowText className="vd-muted">—</RowText>;
  return (
    <RowText>
      <time dateTime={iso} title={formatDateTime(iso)}>
        {timeAgo(iso)}
      </time>
    </RowText>
  );
}

/** The last data a query loaded, kept while the next page of it loads (so a header does not flicker). */
export function useLastSuccess<T>(query: QueryState<T>): T | undefined {
  const [last, setLast] = useState<T>();
  if (query.status === 'success' && query.data !== last) setLast(query.data);
  return query.status === 'success' ? query.data : last;
}
