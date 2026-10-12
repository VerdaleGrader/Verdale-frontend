'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { FilterChips } from '@/components/ui/filter-chips';
import { SortHeader } from '@/components/ui/sort-header';
import { StatSummary } from '@/components/ui/stat-summary';
import { Skeleton } from '@/components/states/states';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VERDICTS } from '@/components/grader/verdict';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { STATUS_LABELS } from '@/features/problems/types';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { reviewApi, type TrackProblemRollup } from '../../api/review.api';
import {
  FilterBar,
  NothingYet,
  OPTION_ALL,
  SearchField,
  SummaryCard,
  TableState,
  Unavailable,
  When,
  isMissing,
  reviewPath,
  sortProps,
  useLastSuccess,
} from './review-parts';

const STATUSES = ['all', 'published', 'draft', 'archived'] as const;
const SORTS = ['track_order', 'solved_fewest', 'last_submission'] as const;
type Sort = (typeof SORTS)[number];

const QUERY = {
  q: param.text(),
  collection: param.text(OPTION_ALL),
  status: param.oneOf(STATUSES, 'all'),
  sort: param.oneOf(SORTS, 'track_order'),
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];
const SORT_OPTIONS = [
  { value: 'track_order', label: 'Track order' },
  { value: 'solved_fewest', label: 'Solved, fewest' },
  { value: 'last_submission', label: 'Last submission, newest' },
];

const COLUMNS = [
  { header: 'Problem', width: 200 },
  { header: 'Collection', width: 96 },
  { header: 'Status', width: 72 },
  { header: 'Tried', numeric: true, width: 32 },
  { header: 'Solved', numeric: true, width: 32 },
  { header: 'Submissions', numeric: true, width: 40 },
  { header: 'Most common failure', width: 160 },
  { header: 'Last submission', width: 80 },
];

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  return (
    <Badge tone={status === 'published' ? 'brand' : status === 'archived' ? 'warning' : 'neutral'}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** "Wrong answer on testcase 4 · 19×", or what to say when nobody has failed it. */
function Failure({ row }: { row: TrackProblemRollup }) {
  const failure = row.most_common_failure;
  if (failure) {
    const where = failure.test_position ? ` on testcase ${failure.test_position}` : '';
    return (
      <VerdictBadge
        verdict={failure.verdict}
        detail={`${VERDICTS[failure.verdict].label}${where} · ${failure.count}×`}
        format="auto"
      />
    );
  }
  if (row.problem.status === 'draft')
    return <RowText className="vd-muted">Hidden from solvers until published</RowText>;
  return <RowText className="vd-muted">{row.submissions === 0 ? 'No submissions yet' : '—'}</RowText>;
}

/** Group by track, step 2: the problems of one Track with how people got on. A row opens its submissions. */
export function TrackProblemsView() {
  const { trackSlug } = useParams<{ trackSlug: string }>();
  const { space } = useSpace();
  const { auth } = useAuth();
  const { values, set } = useUrlQuery(QUERY);
  const [draft, setDraft] = useDebouncedText(values.q, (q) => set({ q }));

  const query = useApiQuery(
    () =>
      reviewApi.trackProblems(space, trackSlug, {
        q: values.q,
        collection: values.collection,
        status: values.status,
        sort: values.sort,
      }),
    JSON.stringify(['track-problems', space.slug, trackSlug, values, auth.status])
  );
  const page = useLastSuccess(query);
  const track = page?.track;
  const base = reviewPath(space.slug);

  if (query.status === 'error' && isMissing(query.error)) {
    return (
      <Unavailable
        title="This track isn’t available"
        description="It may not exist, or your role in this Space doesn’t let you see it."
        href={`${base}?group=track`}
        action="Back to submissions"
      />
    );
  }

  const collections = page?.collections ?? [];
  const collectionOptions = [
    { value: OPTION_ALL, label: 'All collections' },
    ...collections.map((collection) => ({ value: collection.slug, label: collection.name })),
  ];
  const collection =
    collections.length === 0 || collections.some((item) => item.slug === values.collection)
      ? values.collection
      : OPTION_ALL;
  const chips = [
    values.q && { key: 'q', label: `Search: “${values.q}”` },
    collection !== OPTION_ALL && {
      key: 'collection',
      label: `Collection: ${collectionOptions.find((option) => option.value === collection)?.label ?? collection}`,
    },
    values.status !== 'all' && {
      key: 'status',
      label: `Status: ${STATUS_OPTIONS.find((option) => option.value === values.status)!.label}`,
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));
  const clear = () => set({ q: '', collection: OPTION_ALL, status: 'all' });
  const remove = (key: string) => set({ [key]: QUERY[key as keyof typeof QUERY].default });
  const sort = (keys: { desc?: Sort; asc?: Sort }) => sortProps(values.sort, keys, (next) => set({ sort: next }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Submissions', href: base },
          { label: 'By track', href: `${base}?group=track` },
          { label: track?.name ?? trackSlug },
        ]}
      />

      <SummaryCard label="Track summary">
        {track ? (
          <>
            <div className="flex flex-col">
              <h2 className="text-h2">{track.name}</h2>
              <span className="text-small text-text-muted">
                {track.visibility === 'members' ? 'Track members only' : 'Everyone in the Space'} · {track.collections}{' '}
                {track.collections === 1 ? 'collection' : 'collections'} · {track.problems}{' '}
                {track.problems === 1 ? 'problem' : 'problems'}
              </span>
            </div>
            <StatSummary
              stats={[
                { label: 'Members', value: track.members },
                { label: 'Submissions', value: track.submissions },
                { label: 'Accepted', value: track.accepted, tone: 'brand' },
                { label: 'Finished track', value: track.finished },
              ]}
            />
          </>
        ) : (
          <Skeleton width={240} height={28} />
        )}
      </SummaryCard>

      <FilterBar label="Filter problems">
        <SearchField placeholder="Problem name or slug" value={draft} onChange={setDraft} />
        <Dropdown
          label="Collection"
          className="w-[200px]"
          options={collectionOptions}
          value={collection}
          onValueChange={(next) => set({ collection: next })}
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
            title="No problems in this track"
            description="Add problems to a collection of this track and their submissions are listed here."
            href={`${base}?group=track`}
            action="Back to tracks"
          />
        }
      >
        {(data) => (
          <div className="vd-tablewrap">
            <table className="vd-table">
              <caption className="vd-sr">Problems in {track?.name ?? trackSlug}</caption>
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Collection</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-num">
                    Tried
                  </th>
                  <SortHeader numeric {...sort({ asc: 'solved_fewest' })}>
                    Solved
                  </SortHeader>
                  <th scope="col" className="is-num">
                    Submissions
                  </th>
                  <th scope="col">Most common failure</th>
                  <SortHeader {...sort({ desc: 'last_submission' })}>Last submission</SortHeader>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const href = `${reviewPath(space.slug, 'problems', row.problem.slug)}?track=${encodeURIComponent(trackSlug)}`;
                  return (
                    <ClickableRow key={row.problem.slug} href={href}>
                      <td>
                        <Link href={href} className="vd-link">
                          {row.problem.title}
                        </Link>{' '}
                        <RowText className="vd-mono vd-muted">{row.problem.slug}</RowText>
                      </td>
                      <td>
                        <RowText>{row.collections.map((item) => item.name).join(', ') || '—'}</RowText>
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
                      <td>
                        <Failure row={row} />
                      </td>
                      <td>
                        <When iso={row.last_submission_at} />
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TableState>
    </>
  );
}
