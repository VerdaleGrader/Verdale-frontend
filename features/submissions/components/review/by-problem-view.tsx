'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { FilterChips } from '@/components/ui/filter-chips';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { reviewApi, type ProblemRollup } from '../../api/review.api';
import { StatusBadge } from './track-problems-view';
import {
  FilterBar,
  NothingYet,
  OPTION_ALL,
  SearchField,
  TableState,
  When,
  dash,
  reviewPath,
  sortProps,
  useTrackOptions,
} from './review-parts';

const PAGE_SIZE = 20;
const STATUSES = ['all', 'published', 'draft', 'archived'] as const;
const SORTS = ['last_submission', 'submissions', 'solved_fewest', 'name'] as const;
type Sort = (typeof SORTS)[number];

const QUERY = {
  q: param.text(),
  track: param.text(OPTION_ALL),
  status: param.oneOf(STATUSES, 'all'),
  sort: param.oneOf(SORTS, 'last_submission'),
  page: param.page(),
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];
const SORT_OPTIONS = [
  { value: 'last_submission', label: 'Last submission, newest' },
  { value: 'submissions', label: 'Submissions, most' },
  { value: 'solved_fewest', label: 'Solved, fewest' },
  { value: 'name', label: 'Problem, A to Z' },
];

const COLUMNS = [
  { header: 'Problem', width: 200 },
  { header: 'Track', width: 120 },
  { header: 'Status', width: 72 },
  { header: 'Tried', numeric: true, width: 32 },
  { header: 'Solved', numeric: true, width: 32 },
  { header: 'Submissions', numeric: true, width: 40 },
  { header: 'Last verdict', width: 96 },
  { header: 'Last submission', width: 80 },
];

/** The Tracks a problem is in: the first two by name, the rest as "+1". */
function TrackBadges({ tracks }: { tracks: ProblemRollup['tracks'] }) {
  if (tracks.length === 0) return <RowText className="vd-muted italic">Not in any track</RowText>;
  const [first, second, ...rest] = tracks;
  return (
    <span className="inline-flex gap-1">
      <Badge>{first!.name}</Badge>
      {second && <Badge>{rest.length === 0 ? second.name : '+' + (rest.length + 1)}</Badge>}
    </span>
  );
}

/** Group by problem, step 1: every problem of the Space, in any Track or none. A row opens its submissions. */
export function ByProblemView() {
  const { space } = useSpace();
  const { auth } = useAuth();
  const { values, set } = useUrlQuery(QUERY);
  const [draft, setDraft] = useDebouncedText(values.q, (q) => set({ q }));
  const tracks = useTrackOptions(space.slug, 'All');
  const track = tracks.known(values.track) ? values.track : OPTION_ALL;

  const query = useApiQuery(
    () =>
      reviewApi.byProblem(space, {
        q: values.q,
        track,
        status: values.status,
        sort: values.sort,
        page: values.page,
        pageSize: PAGE_SIZE,
      }),
    JSON.stringify(['by-problem', space.slug, values, track, auth.status])
  );

  const chips = [
    values.q && { key: 'q', label: `Search: “${values.q}”` },
    track !== OPTION_ALL && { key: 'track', label: `Track: ${tracks.nameOf(track)}` },
    values.status !== 'all' && {
      key: 'status',
      label: `Status: ${STATUS_OPTIONS.find((option) => option.value === values.status)!.label}`,
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));
  const clear = () => set({ q: '', track: OPTION_ALL, status: 'all' });
  const remove = (key: string) => set({ [key]: QUERY[key as keyof typeof QUERY].default });
  const sort = (keys: { desc?: Sort; asc?: Sort }) => sortProps(values.sort, keys, (next) => set({ sort: next }));

  return (
    <>
      <FilterBar label="Filter problems">
        <SearchField placeholder="Problem name or slug" value={draft} onChange={setDraft} />
        <Dropdown
          label="Track"
          className="w-[220px]"
          options={tracks.options}
          value={track}
          onValueChange={(next) => set({ track: next })}
        />
        <Dropdown
          label="Problem status"
          className="w-[180px]"
          options={STATUS_OPTIONS}
          value={values.status}
          onValueChange={(status) => set({ status: status as (typeof STATUSES)[number] })}
        />
        <Dropdown
          label="Sort"
          className="w-[220px]"
          options={SORT_OPTIONS}
          value={values.sort}
          onValueChange={(next) => set({ sort: next as Sort })}
        />
      </FilterBar>
      <FilterChips filters={chips} onRemove={remove} onClear={clear} />

      <TableState
        query={query}
        columns={COLUMNS}
        label="problems"
        filtered={chips.length > 0}
        onClear={clear}
        isEmpty={(data) => data.items.length === 0}
        failure="Problems could not be loaded"
        empty={
          <NothingYet
            title="No problems yet"
            description="Problems appear here once they are created in this Space."
            href={`/spaces/${space.slug}/problems`}
            action="Go to problems"
          />
        }
      >
        {(data) => (
          <>
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Problems and their submissions</caption>
                <thead>
                  <tr>
                    <SortHeader {...sort({ asc: 'name' })}>Problem</SortHeader>
                    <th scope="col">Track</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="is-num">
                      Tried
                    </th>
                    <SortHeader numeric {...sort({ asc: 'solved_fewest' })}>
                      Solved
                    </SortHeader>
                    <SortHeader numeric {...sort({ desc: 'submissions' })}>
                      Submissions
                    </SortHeader>
                    <th scope="col">Last verdict</th>
                    <SortHeader {...sort({ desc: 'last_submission' })}>Last submission</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const href = reviewPath(space.slug, 'problems', row.problem.slug);
                    return (
                      <ClickableRow key={row.problem.slug} href={href}>
                        <td>
                          <Link href={href} className="vd-link">
                            {row.problem.title}
                          </Link>{' '}
                          <RowText className="vd-mono vd-muted">{row.problem.slug}</RowText>
                        </td>
                        <td>
                          <TrackBadges tracks={row.tracks} />
                        </td>
                        <td>
                          <StatusBadge status={row.problem.status} />
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.tried}</RowText>
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.solved}</RowText>
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.submissions}</RowText>
                        </td>
                        <td>{row.last_verdict ? <VerdictBadge verdict={row.last_verdict} format="auto" /> : dash}</td>
                        <td>
                          {row.last_submission_at ? (
                            <When iso={row.last_submission_at} />
                          ) : (
                            <RowText className="vd-muted">No submissions yet</RowText>
                          )}
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={values.page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPage={(next) => set({ page: next })}
            />
          </>
        )}
      </TableState>
    </>
  );
}
